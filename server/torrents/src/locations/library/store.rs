use std::collections::HashMap;
use std::path::PathBuf;

use rusqlite::{Connection, Row, params};
use watchit_core::AppResult;

use super::LibraryLink;

pub fn create_table(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS library_files (
            info_hash TEXT NOT NULL REFERENCES transfers (info_hash) ON DELETE CASCADE,
            file_index INTEGER NOT NULL,
            path TEXT NOT NULL,
            PRIMARY KEY (info_hash, path)
        )",
    )?;
    Ok(())
}

fn link(row: &Row) -> rusqlite::Result<(String, LibraryLink)> {
    let index: i64 = row.get("file_index")?;
    let path: String = row.get("path")?;
    Ok((row.get("info_hash")?, LibraryLink { file_index: index.max(0) as usize, path: PathBuf::from(path) }))
}

pub fn load(conn: &Connection) -> AppResult<HashMap<String, Vec<LibraryLink>>> {
    let mut found: HashMap<String, Vec<LibraryLink>> = HashMap::new();
    let rows = conn.prepare("SELECT info_hash, file_index, path FROM library_files")?.query_map([], link)?.collect::<Result<Vec<_>, _>>()?;
    for (hash, link) in rows {
        found.entry(hash).or_default().push(link);
    }
    Ok(found)
}

pub fn save(conn: &Connection, info_hash: &str, links: &[LibraryLink]) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM library_files WHERE info_hash = ?1", [info_hash])?;
    let mut insert = tx.prepare("INSERT OR REPLACE INTO library_files (info_hash, file_index, path) VALUES (?1, ?2, ?3)")?;
    for link in links {
        insert.execute(params![info_hash, link.file_index as i64, link.path.to_string_lossy()])?;
    }
    drop(insert);
    tx.commit()?;
    Ok(())
}
