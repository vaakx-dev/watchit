use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};
use watchit_catalog::CatalogKind;
use watchit_core::{AppError, AppResult};

use super::pairing::{Meeting, meeting};
use super::ratings::Outcome;
use crate::query::kind_condition;
use crate::titles::LIBRARY_TITLES;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS duel_results (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first TEXT NOT NULL,
    second TEXT NOT NULL,
    score REAL NOT NULL CHECK (score IN (0.5, 1))
  );
  CREATE INDEX IF NOT EXISTS duel_results_profile ON duel_results(profile_id, id);
  CREATE TABLE IF NOT EXISTS duel_skips (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first TEXT NOT NULL,
    second TEXT NOT NULL,
    PRIMARY KEY (profile_id, first, second)
  ) WITHOUT ROWID;
";

pub fn watched(conn: &Connection, profile: i64, kind: CatalogKind) -> AppResult<Vec<String>> {
    let sql = format!(
        "{LIBRARY_TITLES} SELECT lib.id FROM lib WHERE lib.status = 'watched' AND {} ORDER BY lib.title COLLATE NOCASE, lib.id",
        kind_condition(kind)
    );
    let ids = conn
        .prepare_cached(&sql)?
        .query_map([profile], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(ids)
}

pub fn outcomes(conn: &Connection, profile: i64) -> AppResult<Vec<Outcome>> {
    let outcomes = conn
        .prepare_cached("SELECT first, second, score FROM duel_results WHERE profile_id = ?1")?
        .query_map([profile], |row| {
            Ok(Outcome {
                first: row.get(0)?,
                second: row.get(1)?,
                score: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(outcomes)
}

pub fn skips(conn: &Connection, profile: i64) -> AppResult<HashSet<Meeting>> {
    let pairs = conn
        .prepare_cached("SELECT first, second FROM duel_skips WHERE profile_id = ?1")?
        .query_map([profile], |row| Ok(meeting(&row.get::<_, String>(0)?, &row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(pairs)
}

fn check_contenders(conn: &Connection, profile: i64, first: &str, second: &str) -> AppResult<()> {
    if first == second {
        return Err(AppError::bad_request("A duel needs two different titles."));
    }
    let watched = watched(conn, profile, CatalogKind::All)?;
    if [first, second].iter().all(|id| watched.iter().any(|watched| watched == id)) {
        Ok(())
    } else {
        Err(AppError::bad_request("Only titles marked Watched can duel."))
    }
}

pub fn record(conn: &Connection, profile: i64, winner: &str, other: &str, tie: bool) -> AppResult<()> {
    check_contenders(conn, profile, winner, other)?;
    let score = if tie { 0.5 } else { 1.0 };
    conn.prepare_cached("INSERT INTO duel_results (profile_id, first, second, score) VALUES (?1, ?2, ?3, ?4)")?
        .execute(params![profile, winner, other, score])?;
    Ok(())
}

pub fn skip(conn: &Connection, profile: i64, first: &str, second: &str) -> AppResult<()> {
    check_contenders(conn, profile, first, second)?;
    let (first, second) = meeting(first, second);
    conn.prepare_cached("INSERT OR IGNORE INTO duel_skips (profile_id, first, second) VALUES (?1, ?2, ?3)")?
        .execute(params![profile, first, second])?;
    Ok(())
}

pub fn undo(conn: &Connection, profile: i64) -> AppResult<Option<(String, String)>> {
    let undone = conn
        .prepare_cached(
            "DELETE FROM duel_results WHERE id = (SELECT MAX(id) FROM duel_results WHERE profile_id = ?1) RETURNING first, second",
        )?
        .query_row([profile], |row| Ok((row.get(0)?, row.get(1)?)))
        .optional()?;
    Ok(undone)
}
