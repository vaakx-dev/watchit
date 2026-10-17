use std::collections::BTreeMap;

use rusqlite::{Connection, TransactionBehavior, params};
use watchit_catalog::Catalog;
use watchit_core::AppResult;

use crate::entries;
use crate::progress;
use crate::rating::Rating;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS season_ratings (
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    series_id TEXT NOT NULL,
    season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 99999),
    rating REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER)),
    PRIMARY KEY (profile_id, series_id, season)
  ) WITHOUT ROWID;
";

pub fn all(conn: &Connection, profile: i64) -> AppResult<BTreeMap<String, BTreeMap<i64, Rating>>> {
    let mut statement = conn.prepare_cached("SELECT series_id, season, rating FROM season_ratings WHERE profile_id = ?1")?;
    let rows = statement.query_map([profile], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, Rating>(2)?)))?;
    let mut seasons: BTreeMap<String, BTreeMap<i64, Rating>> = BTreeMap::new();
    for row in rows {
        let (series_id, season, rating) = row?;
        seasons.entry(series_id).or_default().insert(season, rating);
    }
    Ok(seasons)
}

pub fn rate(conn: &Connection, profile: i64, series_id: &str, season: i64, rating: Option<Rating>) -> AppResult<()> {
    match rating {
        Some(rating) => conn
            .prepare_cached(
                "INSERT INTO season_ratings (profile_id, series_id, season, rating) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(profile_id, series_id, season) DO UPDATE SET rating = excluded.rating",
            )?
            .execute(params![profile, series_id, season, rating])?,
        None => conn
            .prepare_cached("DELETE FROM season_ratings WHERE profile_id = ?1 AND series_id = ?2 AND season = ?3")?
            .execute(params![profile, series_id, season])?,
    };
    Ok(())
}

pub fn mark_watched(conn: &mut Connection, catalog: &Catalog, profile: i64, series_id: &str, season: i64, watched: bool) -> AppResult<()> {
    let episodes = catalog.season_episodes(conn, series_id, season)?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    for id in &episodes {
        if watched {
            tx.prepare_cached(
                "INSERT INTO library_entries (profile_id, id, series_id, status) VALUES (?1, ?2, ?3, 'watched')
                 ON CONFLICT(profile_id, id) DO UPDATE SET status = 'watched', series_id = excluded.series_id",
            )?
            .execute(params![profile, id, series_id])?;
            progress::forget(&tx, profile, id)?;
        } else {
            tx.prepare_cached("UPDATE library_entries SET status = NULL WHERE profile_id = ?1 AND id = ?2 AND status = 'watched'")?
                .execute(params![profile, id])?;
        }
    }
    entries::drop_empty(&tx, profile)?;
    tx.commit()?;
    Ok(())
}
