use rusqlite::Connection;
use watchit_catalog::{MediaKind, Personal, Title, TitleExtras};
use watchit_core::AppResult;

use crate::Library;
use crate::hidden;
use crate::playback_source;
use crate::progress::{get, series_progress};
use crate::status::Status;

impl Personal for Library {
    fn hidden(&self, conn: &Connection, profile: i64, statuses: &[String]) -> AppResult<Vec<String>> {
        let statuses: Vec<Status> = statuses.iter().filter_map(|status| Status::parse(status)).collect();
        hidden::ids(conn, profile, &statuses)
    }

    fn settled(&self, conn: &Connection, profile: i64) -> AppResult<Vec<String>> {
        hidden::ids(conn, profile, &[Status::Watched, Status::Dropped])
    }

    fn title(&self, conn: &Connection, profile: i64, title: &Title) -> AppResult<TitleExtras> {
        let id = title.entry.id.as_str();
        let series = match title.entry.kind {
            MediaKind::Series => Some(id),
            MediaKind::Episode => title.series.as_ref().map(|series| series.id.as_str()),
            MediaKind::Movie => None,
        };
        Ok(TitleExtras {
            playback_source: playback_source::get(conn, profile, id)?,
            progress: series.map(|series| series_progress(conn, &self.catalog, profile, series)).transpose()?,
            position: get(conn, profile, id)?,
        })
    }
}
