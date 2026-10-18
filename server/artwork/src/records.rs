use rusqlite::{Connection, OptionalExtension, Row, params};
use watchit_core::AppResult;

use crate::key::ImageKey;

const DAY_MS: f64 = 86_400_000.0;

#[derive(Clone, Debug)]
pub(crate) struct ImageRecord {
    pub key: ImageKey,
    pub source_url: String,
    pub bytes: i64,
    pub fetched_at: Option<i64>,
    pub accessed_at: i64,
    pub retry_at: i64,
    pub failures: i64,
    pub error: Option<String>,
}

const COLUMNS: &str = "key, source_url, bytes, fetched_at, accessed_at, retry_at, failures, error";

pub(crate) fn create(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS images (
            key TEXT PRIMARY KEY,
            source_url TEXT NOT NULL,
            jitter REAL NOT NULL,
            bytes INTEGER NOT NULL DEFAULT 0,
            fetched_at INTEGER,
            accessed_at INTEGER NOT NULL DEFAULT 0,
            retry_at INTEGER NOT NULL DEFAULT 0,
            failures INTEGER NOT NULL DEFAULT 0,
            error TEXT
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS images_lru ON images(accessed_at, key) WHERE fetched_at IS NOT NULL;
        CREATE TABLE IF NOT EXISTS artwork_settings (key TEXT PRIMARY KEY, value REAL NOT NULL);",
    )?;
    Ok(())
}

fn record(row: &Row<'_>) -> rusqlite::Result<ImageRecord> {
    let key: String = row.get(0)?;
    Ok(ImageRecord {
        key: ImageKey::parse(&key).ok_or(rusqlite::Error::InvalidQuery)?,
        source_url: row.get(1)?,
        bytes: row.get(2)?,
        fetched_at: row.get(3)?,
        accessed_at: row.get(4)?,
        retry_at: row.get(5)?,
        failures: row.get(6)?,
        error: row.get(7)?,
    })
}

pub(crate) fn register(conn: &Connection, sources: &[(ImageKey, String)]) -> AppResult<()> {
    let mut insert = conn.prepare_cached("INSERT INTO images (key, source_url, jitter) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO NOTHING")?;
    for (key, source_url) in sources {
        insert.execute(params![key.as_str(), source_url, key.jitter()])?;
    }
    Ok(())
}

pub(crate) fn get(conn: &Connection, key: &ImageKey) -> AppResult<Option<ImageRecord>> {
    let sql = format!("SELECT {COLUMNS} FROM images WHERE key = ?1");
    Ok(conn.prepare_cached(&sql)?.query_row([key.as_str()], record).optional()?)
}

pub(crate) fn many(conn: &Connection, keys: &[ImageKey]) -> AppResult<Vec<ImageRecord>> {
    let list = serde_json::to_string(&keys.iter().map(ImageKey::as_str).collect::<Vec<_>>()).unwrap_or_default();
    let sql = format!("SELECT {COLUMNS} FROM images WHERE key IN (SELECT value FROM json_each(?1))");
    let mut statement = conn.prepare_cached(&sql)?;
    let rows = statement.query_map([list], record)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub(crate) fn stored(conn: &Connection, key: &ImageKey, bytes: i64, fetched_at: i64, accessed_at: i64) -> AppResult<()> {
    conn.prepare_cached("UPDATE images SET bytes = ?2, fetched_at = ?3, accessed_at = ?4, retry_at = 0, failures = 0, error = NULL WHERE key = ?1")?
        .execute(params![key.as_str(), bytes, fetched_at, accessed_at])?;
    Ok(())
}

pub(crate) fn clear(conn: &Connection, keys: &[ImageKey]) -> AppResult<()> {
    let mut statement = conn.prepare_cached("UPDATE images SET bytes = 0, fetched_at = NULL WHERE key = ?1")?;
    for key in keys {
        statement.execute([key.as_str()])?;
    }
    Ok(())
}

pub(crate) fn touch(conn: &Connection, key: &ImageKey, at: i64) -> AppResult<()> {
    conn.prepare_cached("UPDATE images SET accessed_at = ?2 WHERE key = ?1")?
        .execute(params![key.as_str(), at])?;
    Ok(())
}

pub(crate) fn failed(conn: &Connection, key: &ImageKey, retry_at: i64, error: &str) -> AppResult<()> {
    conn.prepare_cached("UPDATE images SET retry_at = ?2, failures = failures + 1, error = ?3 WHERE key = ?1")?
        .execute(params![key.as_str(), retry_at, error])?;
    Ok(())
}

pub(crate) fn least_recent(conn: &Connection, limit: usize) -> AppResult<Vec<(ImageKey, i64)>> {
    let mut statement = conn.prepare_cached("SELECT key, bytes FROM images WHERE fetched_at IS NOT NULL ORDER BY accessed_at, key LIMIT ?1")?;
    let rows = statement.query_map([limit as i64], |row| {
        let key: String = row.get(0)?;
        Ok((ImageKey::parse(&key), row.get::<_, i64>(1)?))
    })?;
    let mut list = Vec::new();
    for row in rows {
        if let (Some(key), bytes) = row? {
            list.push((key, bytes));
        }
    }
    Ok(list)
}

pub(crate) fn usage(conn: &Connection) -> AppResult<(i64, i64)> {
    Ok(conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(bytes), 0) FROM images WHERE fetched_at IS NOT NULL AND bytes > 0",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?)
}

pub(crate) fn due(conn: &Connection, after: &str, now: i64, images_days: f64, limit: usize) -> AppResult<Vec<ImageKey>> {
    let mut statement = conn.prepare_cached(
        "SELECT key FROM images WHERE key > ?1 AND retry_at <= ?2
            AND (fetched_at IS NULL OR fetched_at + CAST(?3 * (1.0 - jitter) AS INTEGER) <= ?2)
         ORDER BY key LIMIT ?4",
    )?;
    let rows = statement.query_map(params![after, now, images_days * DAY_MS, limit as i64], |row| row.get::<_, String>(0))?;
    let mut keys = Vec::new();
    for row in rows {
        keys.extend(ImageKey::parse(&row?));
    }
    Ok(keys)
}
