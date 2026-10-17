use std::collections::BTreeMap;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use watchit_catalog::MediaKind;
use watchit_core::AppResult;

use super::types::{PersonalEntry, PersonalPatch};
use crate::clock::now_iso;
use crate::progress;
use crate::rankings;
use crate::rating::Rating;
use crate::status::Status;
use crate::titles::TitleRef;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS library_entries (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    series_id TEXT,
    rating REAL CHECK (rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
    status TEXT CHECK (status IS NULL OR status IN ('want', 'watching', 'paused', 'watched', 'dropped')),
    favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
    recommended INTEGER NOT NULL DEFAULT 0 CHECK (recommended IN (0, 1)),
    saved INTEGER NOT NULL DEFAULT 0 CHECK (saved IN (0, 1)),
    opened_at TEXT,
    position INTEGER,
    PRIMARY KEY (profile_id, id)
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS library_entries_series ON library_entries(profile_id, series_id) WHERE series_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS library_entries_status ON library_entries(profile_id, status) WHERE status IS NOT NULL;
";

#[derive(Clone, Default)]
struct Marks {
    rating: Option<Rating>,
    status: Option<Status>,
    favorite: bool,
    recommended: bool,
    saved: bool,
    opened_at: Option<String>,
}

impl Marks {
    fn patched(mut self, patch: &PersonalPatch) -> Self {
        if let Some(rating) = patch.rating {
            self.rating = rating;
        }
        if let Some(status) = patch.status {
            self.status = status;
        }
        self.favorite = patch.favorite.unwrap_or(self.favorite);
        self.recommended = patch.recommended.unwrap_or(self.recommended);
        self.saved = patch.saved.unwrap_or(self.saved);
        if patch.opened == Some(true) {
            self.opened_at = Some(now_iso());
        }
        self
    }
}

fn load(conn: &Connection, profile: i64, id: &str) -> AppResult<Option<Marks>> {
    let found = conn
        .prepare_cached("SELECT rating, status, favorite, recommended, saved, opened_at FROM library_entries WHERE profile_id = ?1 AND id = ?2")?
        .query_row(params![profile, id], |row| {
            Ok(Marks {
                rating: row.get(0)?,
                status: row.get(1)?,
                favorite: row.get(2)?,
                recommended: row.get(3)?,
                saved: row.get(4)?,
                opened_at: row.get(5)?,
            })
        })
        .optional()?;
    Ok(found)
}

fn store(conn: &Connection, profile: i64, id: &str, series_id: Option<&str>, marks: &Marks) -> AppResult<()> {
    conn.prepare_cached(
        "INSERT INTO library_entries (profile_id, id, series_id, rating, status, favorite, recommended, saved, opened_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(profile_id, id) DO UPDATE SET series_id = excluded.series_id, rating = excluded.rating, status = excluded.status,
           favorite = excluded.favorite, recommended = excluded.recommended, saved = excluded.saved, opened_at = excluded.opened_at",
    )?
    .execute(params![profile, id, series_id, marks.rating, marks.status, marks.favorite, marks.recommended, marks.saved, marks.opened_at])?;
    Ok(())
}

pub fn drop_empty(conn: &Connection, profile: i64) -> AppResult<()> {
    conn.prepare_cached(
        "DELETE FROM library_entries WHERE profile_id = ?1 AND rating IS NULL AND status IS NULL AND favorite = 0
           AND recommended = 0 AND saved = 0 AND opened_at IS NULL",
    )?
    .execute([profile])?;
    Ok(())
}

pub fn apply(conn: &mut Connection, profile: i64, id: &str, title: &TitleRef, patch: &PersonalPatch) -> AppResult<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let previous = load(&tx, profile, id)?.unwrap_or_default();
    let next = previous.clone().patched(patch);
    let series_id = if title.kind == MediaKind::Episode { title.series_id.as_deref() } else { None };
    store(&tx, profile, id, series_id, &next)?;
    if title.kind != MediaKind::Episode && next.rating != previous.rating {
        rankings::rating_changed(&tx, profile, id, previous.rating, next.rating)?;
    }
    if patch.status.is_some_and(Status::clears_progress) {
        progress::forget(&tx, profile, id)?;
    }
    drop_empty(&tx, profile)?;
    tx.commit()?;
    Ok(())
}

pub fn entry(conn: &Connection, profile: i64, id: &str) -> AppResult<PersonalEntry> {
    let marks = load(conn, profile, id)?.unwrap_or_default();
    Ok(PersonalEntry {
        id: id.to_owned(),
        rating: marks.rating,
        status: marks.status,
        favorite: marks.favorite,
        recommended: marks.recommended,
        saved: marks.saved,
        last_opened_at: marks.opened_at,
    })
}

pub fn all(conn: &Connection, profile: i64) -> AppResult<BTreeMap<String, PersonalEntry>> {
    let mut statement = conn.prepare_cached(
        "SELECT id, rating, status, favorite, recommended, saved, opened_at FROM library_entries WHERE profile_id = ?1 ORDER BY id",
    )?;
    let rows = statement.query_map([profile], |row| {
        let id: String = row.get(0)?;
        Ok((
            id.clone(),
            PersonalEntry {
                id,
                rating: row.get(1)?,
                status: row.get(2)?,
      
                favorite: row.get(3)?,
                recommended: row.get(4)?,
                saved: row.get(5)?,
                last_opened_at: row.get(6)?,
            },
        ))
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
