use rusqlite::{Connection, OptionalExtension};
use watchit_core::AppResult;

pub fn create_table(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS torrent_speed (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            alternative INTEGER NOT NULL
        )",
    )?;
    Ok(())
}

pub fn load(conn: &Connection) -> AppResult<bool> {
    let alternative = conn.query_row("SELECT alternative FROM torrent_speed WHERE id = 1", [], |row| row.get(0)).optional()?;
    Ok(alternative.unwrap_or(false))
}

pub fn save(conn: &Connection, alternative: bool) -> AppResult<()> {
    conn.execute(
        "INSERT INTO torrent_speed (id, alternative) VALUES (1, ?1) ON CONFLICT (id) DO UPDATE SET alternative = excluded.alternative",
        [alternative],
    )?;
    Ok(())
}
