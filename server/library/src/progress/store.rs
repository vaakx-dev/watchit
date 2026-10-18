use rusqlite::{Connection, OptionalExtension, params};
use watchit_core::AppResult;

use crate::clock::now_iso;
use watchit_catalog::SavedPosition;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS watch_progress (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    position_seconds REAL NOT NULL CHECK (position_seconds >= 0),
    duration_seconds REAL NOT NULL CHECK (duration_seconds > 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, id)
  ) WITHOUT ROWID;
";

pub fn get(conn: &Connection, profile: i64, id: &str) -> AppResult<Option<SavedPosition>> {
    let found = conn
        .prepare_cached("SELECT position_seconds, duration_seconds FROM watch_progress WHERE profile_id = ?1 AND id = ?2")?
        .query_row(params![profile, id], |row| {
            Ok(SavedPosition {
                position_seconds: row.get(0)?,
                duration_seconds: row.get(1)?,
            })
        })
        .optional()?;
    Ok(found)
}

pub fn put(conn: &Connection, profile: i64, id: &str, position: f64, duration: f64) -> AppResult<()> {
    conn.prepare_cached(
        "INSERT INTO watch_progress (profile_id, id, position_seconds, duration_seconds, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(profile_id, id) DO UPDATE SET position_seconds = excluded.position_seconds,
           duration_seconds = excluded.duration_seconds, updated_at = excluded.updated_at",
    )?
    .execute(params![profile, id, position, duration, now_iso()])?;
    Ok(())
}

pub fn forget(conn: &Connection, profile: i64, id: &str) -> AppResult<()> {
    conn.prepare_cached("DELETE FROM watch_progress WHERE profile_id = ?1 AND id = ?2")?
        .execute(params![profile, id])?;
    Ok(())
}
