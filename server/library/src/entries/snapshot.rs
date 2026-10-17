use rusqlite::{Connection, params};
use watchit_core::AppResult;

use super::store;
use super::types::LibrarySnapshot;
use crate::Library;
use crate::seasons;

const RECENT_LIMIT: i64 = 24;
const IMPORT_BATCH: usize = 200;

fn ids(conn: &Connection, profile: i64, condition: &str, order: &str, limit: i64) -> AppResult<Vec<String>> {
    let sql = format!(
        "SELECT e.id FROM library_entries e JOIN titles ON titles.id = e.id WHERE e.profile_id = ?1 AND {condition} ORDER BY {order} LIMIT ?2"
    );
    let ids = conn.prepare_cached(&sql)?.query_map(params![profile, limit], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(ids)
}

impl Library {
    pub(crate) async fn snapshot(&self, profile: i64) -> AppResult<LibrarySnapshot> {
        let catalog = self.catalog.clone();
        self.db
            .run(move |conn| {
                let saved = ids(conn, profile, "e.saved = 1", "titles.title COLLATE NOCASE, titles.id", -1)?;
                let recent = ids(conn, profile, "e.opened_at IS NOT NULL", "e.opened_at DESC, titles.id", RECENT_LIMIT)?;
                let (saved, _) = catalog.entries(conn, &saved)?;
                let (recent, artwork_status) = catalog.entries(conn, &recent)?;
                Ok(LibrarySnapshot {
                    entries: store::all(conn, profile)?,
                    seasons: seasons::all(conn, profile)?,
                    saved,
                    recent,
                    artwork_status,
                })
            })
            .await
    }

    pub(crate) fn request_missing(&self, conn: &Connection, profile: i64) -> AppResult<()> {
        let mut statement = conn.prepare_cached("SELECT DISTINCT COALESCE(series_id, id) FROM library_entries WHERE profile_id = ?1")?;
        let wanted: Vec<String> = statement.query_map([profile], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
        let mut requested = 0;
        for id in wanted.iter().filter(|id| self.catalog.kind(conn, id).ok().flatten().is_none()) {
            self.catalog.import_title(conn, id)?;
            requested += 1;
            if requested == IMPORT_BATCH {
                break;
            }
        }
        Ok(())
    }
}
