use std::collections::HashMap;

use rusqlite::{Connection, params};
use watchit_core::AppResult;

pub fn create_table(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS transfer_queue (
            info_hash TEXT PRIMARY KEY REFERENCES transfers (info_hash) ON DELETE CASCADE,
            rank INTEGER NOT NULL
        );",
    )?;
    Ok(())
}

pub fn load_ranks(conn: &Connection) -> AppResult<HashMap<String, i64>> {
    let ranks = conn
        .prepare("SELECT info_hash, rank FROM transfer_queue")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<_, _>>()?;
    Ok(ranks)
}

pub fn save_rank(conn: &Connection, info_hash: &str, rank: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO transfer_queue (info_hash, rank) VALUES (?1, ?2) ON CONFLICT (info_hash) DO UPDATE SET rank = excluded.rank",
        params![info_hash, rank],
    )?;
    Ok(())
}
