use rusqlite::{Connection, OptionalExtension, params};
use watchit_core::{AppError, AppResult};

use crate::ids::series_of;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS playback_sources (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (profile_id, id)
  ) WITHOUT ROWID;
";

pub fn get(conn: &Connection, profile: i64, id: &str) -> AppResult<Option<String>> {
    let source = conn
        .prepare_cached("SELECT source FROM playback_sources WHERE profile_id = ?1 AND id = ?2")?
        .query_row(params![profile, series_of(id)], |row| row.get(0))
        .optional()?;
    Ok(source)
}

pub fn valid_source(source: &str) -> bool {
    let mut bytes = source.bytes();
    bytes.next().is_some_and(|first| first.is_ascii_lowercase() || first.is_ascii_digit())
        && source.len() <= 32
        && bytes.all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

pub fn put(conn: &Connection, profile: i64, id: &str, source: Option<&str>) -> AppResult<()> {
    let target = series_of(id);
    match source {
        Some(source) if !valid_source(source) => return Err(AppError::bad_request("Invalid playback source")),
        Some(source) => {
            conn.prepare_cached(
                "INSERT INTO playback_sources (profile_id, id, source) VALUES (?1, ?2, ?3)
                 ON CONFLICT(profile_id, id) DO UPDATE SET source = excluded.source",
            )?
            .execute(params![profile, target, source])?;
        }
        None => {
            conn.prepare_cached("DELETE FROM playback_sources WHERE profile_id = ?1 AND id = ?2")?
                .execute(params![profile, target])?;
        }
    }
    Ok(())
}
