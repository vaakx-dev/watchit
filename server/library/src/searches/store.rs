use rusqlite::{Connection, params};
use watchit_core::{AppError, AppResult};

use crate::clock::now_ms;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS recent_searches (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    query TEXT NOT NULL,
    searched_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, key)
  ) WITHOUT ROWID;
";

const KEEP: i64 = 10;
const MAX_CHARS: usize = 200;

fn key(query: &str) -> String {
    query.to_lowercase()
}

pub fn list(conn: &Connection, profile: i64) -> AppResult<Vec<String>> {
    let mut statement = conn.prepare_cached("SELECT query FROM recent_searches WHERE profile_id = ?1 ORDER BY searched_at DESC LIMIT ?2")?;
    let rows = statement.query_map(params![profile, KEEP], |row| row.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn remember(conn: &Connection, profile: i64, query: &str) -> AppResult<()> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > MAX_CHARS {
        return Err(AppError::bad_request("A search must be 1 to 200 characters."));
    }
    conn.prepare_cached(
        "INSERT INTO recent_searches (profile_id, key, query, searched_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(profile_id, key) DO UPDATE SET query = excluded.query, searched_at = excluded.searched_at",
    )?
    .execute(params![profile, key(query), query, now_ms()])?;
    conn.prepare_cached(
        "DELETE FROM recent_searches WHERE profile_id = ?1 AND key NOT IN
         (SELECT key FROM recent_searches WHERE profile_id = ?1 ORDER BY searched_at DESC LIMIT ?2)",
    )?
    .execute(params![profile, KEEP])?;
    Ok(())
}

pub fn forget(conn: &Connection, profile: i64, query: &str) -> AppResult<()> {
    conn.prepare_cached("DELETE FROM recent_searches WHERE profile_id = ?1 AND key = ?2")?.execute(params![profile, key(query.trim())])?;
    Ok(())
}

pub fn clear(conn: &Connection, profile: i64) -> AppResult<()> {
    conn.prepare_cached("DELETE FROM recent_searches WHERE profile_id = ?1")?.execute([profile])?;
    Ok(())
}
