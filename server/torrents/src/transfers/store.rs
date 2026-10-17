use rusqlite::{Connection, Row, params};
use watchit_core::{AppError, AppResult};

use super::model::Kind;
use super::record::{FileRecord, Record};

pub fn create_tables(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS transfers (
            info_hash TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            title_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            paused INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            last_used_at INTEGER NOT NULL,
            uploaded_bytes INTEGER NOT NULL,
            seeded_seconds INTEGER NOT NULL,
            trackers TEXT NOT NULL,
            error TEXT,
            picks TEXT NOT NULL,
            notify_when_ready INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transfer_files (
            info_hash TEXT NOT NULL REFERENCES transfers (info_hash) ON DELETE CASCADE,
            file_index INTEGER NOT NULL,
            name TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            title_id TEXT,
            PRIMARY KEY (info_hash, file_index)
        );
        CREATE INDEX IF NOT EXISTS transfer_files_title ON transfer_files (title_id);",
    )?;
    Ok(())
}

fn json<T: serde::de::DeserializeOwned>(text: String) -> rusqlite::Result<T> {
    serde_json::from_str(&text).map_err(|error| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error)))
}

fn unsigned(row: &Row, column: &str) -> rusqlite::Result<u64> {
    Ok(row.get::<_, i64>(column)?.max(0) as u64)
}

fn signed(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn record(row: &Row) -> rusqlite::Result<Record> {
    Ok(Record {
        info_hash: row.get("info_hash")?,
        name: row.get("name")?,
        title_id: row.get("title_id")?,
        kind: Kind::parse(&row.get::<_, String>("kind")?),
        paused: row.get("paused")?,
        added_at: row.get("added_at")?,
        last_used_at: row.get("last_used_at")?,
        uploaded_bytes: unsigned(row, "uploaded_bytes")?,
        seeded_seconds: unsigned(row, "seeded_seconds")?,
        trackers: json(row.get("trackers")?)?,
        error: row.get("error")?,
        picks: json(row.get("picks")?)?,
        notify_when_ready: row.get("notify_when_ready")?,
    })
}

fn file(row: &Row) -> rusqlite::Result<(String, FileRecord)> {
    Ok((
        row.get("info_hash")?,
        FileRecord {
            index: unsigned(row, "file_index")? as usize,
            name: row.get("name")?,
            size_bytes: unsigned(row, "size_bytes")?,
            title_id: row.get("title_id")?,
        },
    ))
}

pub fn load(conn: &Connection) -> AppResult<Vec<(Record, Vec<FileRecord>)>> {
    let records = conn.prepare("SELECT * FROM transfers ORDER BY added_at")?.query_map([], record)?.collect::<Result<Vec<_>, _>>()?;
    let files = conn.prepare("SELECT * FROM transfer_files ORDER BY file_index")?.query_map([], file)?.collect::<Result<Vec<_>, _>>()?;
    Ok(records
        .into_iter()
        .map(|record| {
            let own = files.iter().filter(|(hash, _)| *hash == record.info_hash).map(|(_, file)| file.clone()).collect();
            (record, own)
        })
        .collect())
}

pub fn save(conn: &Connection, record: &Record, files: &[FileRecord]) -> AppResult<()> {
    let trackers = serde_json::to_string(&record.trackers).map_err(AppError::internal)?;
    let picks = serde_json::to_string(&record.picks).map_err(AppError::internal)?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO transfers (info_hash, name, title_id, kind, paused, added_at, last_used_at, uploaded_bytes, seeded_seconds, trackers, error, picks, notify_when_ready)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT (info_hash) DO UPDATE SET name = excluded.name, title_id = excluded.title_id, kind = excluded.kind,
            paused = excluded.paused, last_used_at = excluded.last_used_at, uploaded_bytes = excluded.uploaded_bytes,
            seeded_seconds = excluded.seeded_seconds, trackers = excluded.trackers,
            error = excluded.error, picks = excluded.picks,
            notify_when_ready = excluded.notify_when_ready",
        params![
            record.info_hash,
            record.name,
            record.title_id,
            record.kind.as_str(),
            record.paused,
            record.added_at,
            record.last_used_at,
            signed(record.uploaded_bytes),
            signed(record.seeded_seconds),
            trackers,
            record.error,
            picks,
            record.notify_when_ready
        ],
    )?;
    tx.execute("DELETE FROM transfer_files WHERE info_hash = ?1", [&record.info_hash])?;
    let mut insert = tx.prepare("INSERT INTO transfer_files (info_hash, file_index, name, size_bytes, title_id) VALUES (?1, ?2, ?3, ?4, ?5)")?;
    for file in files {
        insert.execute(params![record.info_hash, signed(file.index as u64), file.name, signed(file.size_bytes), file.title_id])?;
    }
    drop(insert);
    tx.commit()?;
    Ok(())
}

pub fn delete(conn: &Connection, info_hash: &str) -> AppResult<()> {
    conn.execute("DELETE FROM transfers WHERE info_hash = ?1", [info_hash])?;
    Ok(())
}
