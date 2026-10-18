use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use watchit_catalog::CatalogKind;
use watchit_core::{AppError, AppResult};

use super::elo::{self, Duelist, START};
use super::pairing::{Meeting, meeting};
use crate::query::kind_condition;
use crate::titles::LIBRARY_TITLES;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS duel_ratings (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    games INTEGER NOT NULL CHECK (games > 0),
    PRIMARY KEY (profile_id, id)
  ) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS duel_matches (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first TEXT NOT NULL,
    second TEXT NOT NULL,
    score REAL NOT NULL CHECK (score IN (0.5, 1)),
    first_rating INTEGER NOT NULL,
    second_rating INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS duel_matches_profile ON duel_matches(profile_id, id);
  CREATE TABLE IF NOT EXISTS duel_skips (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first TEXT NOT NULL,
    second TEXT NOT NULL,
    PRIMARY KEY (profile_id, first, second)
  ) WITHOUT ROWID;
";

pub fn pool(conn: &Connection, profile: i64, kind: CatalogKind) -> AppResult<Vec<Duelist>> {
    let sql = format!(
        "{LIBRARY_TITLES} SELECT lib.id, COALESCE(d.rating, {START}), COALESCE(d.games, 0) FROM lib
         LEFT JOIN duel_ratings d ON d.profile_id = ?1 AND d.id = lib.id
         WHERE lib.status = 'watched' AND {} ORDER BY lib.title COLLATE NOCASE, lib.id",
        kind_condition(kind)
    );
    let duelists = conn
        .prepare_cached(&sql)?
        .query_map([profile], |row| {
            Ok(Duelist {
                id: row.get(0)?,
                rating: row.get(1)?,
                games: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(duelists)
}

pub fn met(conn: &Connection, profile: i64) -> AppResult<HashSet<Meeting>> {
    let pairs = conn
        .prepare_cached(
            "SELECT first, second FROM duel_matches WHERE profile_id = ?1 UNION SELECT first, second FROM duel_skips WHERE profile_id = ?1",
        )?
        .query_map([profile], |row| Ok(meeting(&row.get::<_, String>(0)?, &row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(pairs)
}

pub fn can_undo(conn: &Connection, profile: i64) -> AppResult<bool> {
    let found = conn
        .prepare_cached("SELECT 1 FROM duel_matches WHERE profile_id = ?1 LIMIT 1")?
        .exists([profile])?;
    Ok(found)
}

fn contenders(conn: &Connection, profile: i64, first: &str, second: &str) -> AppResult<(Duelist, Duelist)> {
    if first == second {
        return Err(AppError::bad_request("A duel needs two different titles."));
    }
    let pool = pool(conn, profile, CatalogKind::All)?;
    let find = |id: &str| {
        pool.iter()
            .find(|duelist| duelist.id == id)
            .cloned()
            .ok_or_else(|| AppError::bad_request("Only titles marked Watched can duel."))
    };
    Ok((find(first)?, find(second)?))
}

fn save(conn: &Connection, profile: i64, duelist: &Duelist) -> AppResult<()> {
    conn.prepare_cached(
        "INSERT INTO duel_ratings (profile_id, id, rating, games) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(profile_id, id) DO UPDATE SET rating = excluded.rating, games = excluded.games",
    )?
    .execute(params![profile, duelist.id, duelist.rating, duelist.games])?;
    Ok(())
}

pub fn record(conn: &mut Connection, profile: i64, winner: &str, other: &str, tie: bool) -> AppResult<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let (first, second) = contenders(&tx, profile, winner, other)?;
    let score = if tie { 0.5 } else { 1.0 };
    let (first_delta, second_delta) = elo::deltas(&first, &second, score);
    tx.prepare_cached("INSERT INTO duel_matches (profile_id, first, second, score, first_rating, second_rating) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")?
        .execute(params![profile, first.id, second.id, score, first.rating, second.rating])?;
    for (duelist, delta) in [(first, first_delta), (second, second_delta)] {
        let next = Duelist {
            rating: duelist.rating + delta,
            games: duelist.games + 1,
            ..duelist
        };
        save(&tx, profile, &next)?;
    }
    tx.commit()?;
    Ok(())
}

pub fn skip(conn: &Connection, profile: i64, first: &str, second: &str) -> AppResult<()> {
    contenders(conn, profile, first, second)?;
    let (first, second) = meeting(first, second);
    conn.prepare_cached("INSERT OR IGNORE INTO duel_skips (profile_id, first, second) VALUES (?1, ?2, ?3)")?
        .execute(params![profile, first, second])?;
    Ok(())
}

fn restore(conn: &Connection, profile: i64, id: &str, rating: i64) -> AppResult<()> {
    conn.prepare_cached("DELETE FROM duel_ratings WHERE profile_id = ?1 AND id = ?2 AND games = 1")?
        .execute(params![profile, id])?;
    conn.prepare_cached("UPDATE duel_ratings SET rating = ?3, games = games - 1 WHERE profile_id = ?1 AND id = ?2")?
        .execute(params![profile, id, rating])?;
    Ok(())
}

pub fn undo(conn: &mut Connection, profile: i64) -> AppResult<Option<(String, String)>> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let last = tx
        .prepare_cached("SELECT id, first, second, first_rating, second_rating FROM duel_matches WHERE profile_id = ?1 ORDER BY id DESC LIMIT 1")?
        .query_row([profile], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .optional()?;
    let Some((id, first, second, first_rating, second_rating)) = last else {
        return Ok(None);
    };
    restore(&tx, profile, &first, first_rating)?;
    restore(&tx, profile, &second, second_rating)?;
    tx.prepare_cached("DELETE FROM duel_matches WHERE id = ?1")?.execute([id])?;
    tx.commit()?;
    Ok(Some((first, second)))
}
