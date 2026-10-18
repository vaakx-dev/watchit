use rusqlite::{Connection, OptionalExtension};
use watchit_core::{AppError, AppResult};

use super::Settings;

pub fn create_table(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS torrent_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            value TEXT NOT NULL
        )",
    )?;
    Ok(())
}

pub fn load(conn: &Connection) -> AppResult<Option<Settings>> {
    let value: Option<String> = conn
        .query_row("SELECT value FROM torrent_settings WHERE id = 1", [], |row| row.get(0))
        .optional()?;
    value.map(|value| serde_json::from_str(&value).map_err(AppError::internal)).transpose()
}

pub fn save(conn: &Connection, settings: &Settings) -> AppResult<()> {
    let value = serde_json::to_string(settings).map_err(AppError::internal)?;
    conn.execute(
        "INSERT INTO torrent_settings (id, value) VALUES (1, ?1) ON CONFLICT (id) DO UPDATE SET value = excluded.value",
        [value],
    )?;
    Ok(())
}
