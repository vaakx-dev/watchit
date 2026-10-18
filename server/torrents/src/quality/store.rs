use rusqlite::{Connection, OptionalExtension};
use watchit_core::{AppError, AppResult};

use super::Quality;

pub fn create_table(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS torrent_quality (
            profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
            value TEXT NOT NULL
        )",
    )?;
    Ok(())
}

pub fn load(conn: &Connection, profile: i64) -> AppResult<Quality> {
    let value: Option<String> = conn
        .query_row("SELECT value FROM torrent_quality WHERE profile_id = ?1", [profile], |row| row.get(0))
        .optional()?;
    match value {
        Some(value) => serde_json::from_str(&value).map_err(AppError::internal),
        None => Ok(Quality::default()),
    }
}

pub fn save(conn: &Connection, profile: i64, quality: &Quality) -> AppResult<()> {
    let value = serde_json::to_string(quality).map_err(AppError::internal)?;
    conn.execute(
        "INSERT INTO torrent_quality (profile_id, value) VALUES (?1, ?2) ON CONFLICT (profile_id) DO UPDATE SET value = excluded.value",
        rusqlite::params![profile, value],
    )?;
    Ok(())
}
