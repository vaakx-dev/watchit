use rusqlite::{Connection, OptionalExtension, params};
use watchit_core::AppResult;

use super::types::RankingSystem;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS ranking_systems (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    system TEXT NOT NULL CHECK (system IN ('stars', 'duels'))
  );
";

pub fn load(conn: &Connection, profile: i64) -> AppResult<RankingSystem> {
    let system: Option<String> = conn
        .prepare_cached("SELECT system FROM ranking_systems WHERE profile_id = ?1")?
        .query_row([profile], |row| row.get(0))
        .optional()?;
    Ok(system.as_deref().and_then(RankingSystem::parse).unwrap_or_default())
}

pub fn save(conn: &Connection, profile: i64, system: RankingSystem) -> AppResult<()> {
    conn.prepare_cached(
        "INSERT INTO ranking_systems (profile_id, system) VALUES (?1, ?2)
         ON CONFLICT(profile_id) DO UPDATE SET system = excluded.system",
    )?
    .execute(params![profile, system.as_str()])?;
    Ok(())
}
