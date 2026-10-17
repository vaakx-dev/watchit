use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use watchit_catalog::{Catalog, CatalogKind};
use watchit_core::{AppError, AppResult};

use super::types::{RankedItem, RankingTier, Rankings};
use crate::query::kind_condition;
use crate::rating::Rating;
use crate::shelves::build_items;
use crate::titles::{LIBRARY_TITLES, LibraryRow, RANKING_ORDER};

fn tier(conn: &Connection, profile: i64, rating: Rating, except: &str) -> AppResult<Vec<String>> {
    let sql = format!("{LIBRARY_TITLES} SELECT id FROM lib WHERE rating = ?2 AND id <> ?3 ORDER BY {RANKING_ORDER}");
    let ids = conn.prepare_cached(&sql)?.query_map(params![profile, rating, except], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(ids)
}

fn write(conn: &Connection, profile: i64, ids: &[String]) -> AppResult<()> {
    let mut statement = conn.prepare_cached("UPDATE library_entries SET position = ?3 WHERE profile_id = ?1 AND id = ?2")?;
    for (index, id) in ids.iter().enumerate() {
        statement.execute(params![profile, id, index as i64 + 1])?;
    }
    Ok(())
}

pub fn rating_changed(conn: &Connection, profile: i64, id: &str, previous: Option<Rating>, rating: Option<Rating>) -> AppResult<()> {
    let Some(rating) = rating else {
        conn.prepare_cached("UPDATE library_entries SET position = NULL WHERE profile_id = ?1 AND id = ?2")?.execute(params![profile, id])?;
        return Ok(());
    };
    let mut ids = tier(conn, profile, rating, id)?;
    if previous.is_some_and(|previous| rating < previous) {
        ids.insert(0, id.to_owned());
    } else {
        ids.push(id.to_owned());
    }
    write(conn, profile, &ids)
}

pub fn place(conn: &mut Connection, profile: i64, id: &str, before: Option<&str>) -> AppResult<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let rating: Option<Rating> = tx
        .prepare_cached(&format!("{LIBRARY_TITLES} SELECT rating FROM lib WHERE id = ?2"))?
        .query_row(params![profile, id], |row| row.get(0))
        .optional()?
        .flatten();
    let rating = rating.ok_or_else(|| AppError::bad_request("Only rated movies and series can be ranked."))?;
    let mut ids = tier(&tx, profile, rating, id)?;
    let index = match before {
        None => ids.len(),
        Some(before) => ids
            .iter()
            .position(|other| other == before)
            .ok_or_else(|| AppError::bad_request("Titles can only be moved within their rating tier."))?,
    };
    ids.insert(index, id.to_owned());
    write(&tx, profile, &ids)?;
    tx.commit()?;
    Ok(())
}

pub fn rankings(conn: &Connection, catalog: &Catalog, profile: i64, kind: CatalogKind) -> AppResult<Rankings> {
    let sql = format!("{LIBRARY_TITLES} SELECT * FROM lib WHERE rating IS NOT NULL AND {} ORDER BY {RANKING_ORDER}", kind_condition(kind));
    let rows: Vec<LibraryRow> = conn.prepare_cached(&sql)?.query_map([profile], LibraryRow::read)?.collect::<rusqlite::Result<_>>()?;
    let (items, _) = build_items(conn, catalog, profile, &rows)?;
    let mut tiers: Vec<RankingTier> = Vec::new();
    for (index, (row, item)) in rows.iter().zip(items).enumerate() {
        let Some(rating) = row.rating else { continue };
        if tiers.last().is_none_or(|tier| tier.rating != rating) {
            tiers.push(RankingTier { rating, items: Vec::new() });
        }
        let tier = tiers.last_mut().expect("a tier was just pushed");
        let position = tier.items.len() + 1;
        tier.items.push(RankedItem { item, rank: index + 1, position });
    }
    Ok(Rankings { kind, tiers })
}
