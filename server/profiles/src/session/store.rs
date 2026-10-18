use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rusqlite::{Connection, OptionalExtension, params};
use sha2::{Digest, Sha256};
use watchit_core::AppResult;

use crate::clock::now_ms;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_profile ON sessions(profile_id);
";

const TOUCH_INTERVAL_MS: i64 = 60_000;

fn token_hash(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn create(conn: &Connection, profile: i64) -> AppResult<String> {
    let token = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>());
    let now = now_ms();
    conn.execute(
        "INSERT INTO sessions (token_hash, profile_id, created_at, last_used_at) VALUES (?, ?, ?, ?)",
        params![token_hash(&token), profile, now, now],
    )?;
    Ok(token)
}

pub fn profile(conn: &Connection, token: &str) -> AppResult<Option<i64>> {
    let hash = token_hash(token);
    let mut query = conn.prepare_cached("SELECT profile_id, last_used_at FROM sessions WHERE token_hash = ?")?;
    let Some((profile, last_used_at)) = query
        .query_row([&hash], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
        .optional()?
    else {
        return Ok(None);
    };
    let now = now_ms();
    if now - last_used_at > TOUCH_INTERVAL_MS {
        conn.execute("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?", params![now, hash])?;
    }
    Ok(Some(profile))
}

pub fn delete(conn: &Connection, token: &str) -> AppResult<()> {
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", [token_hash(token)])?;
    Ok(())
}

pub fn revoke(conn: &Connection, profile: i64, keep: Option<&str>) -> AppResult<()> {
    conn.execute(
        "DELETE FROM sessions WHERE profile_id = ? AND token_hash IS NOT ?",
        params![profile, keep.map(token_hash)],
    )?;
    Ok(())
}
