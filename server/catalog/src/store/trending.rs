use rusqlite::types::Value;
use rusqlite::{Connection, params};
use watchit_artwork::Artwork;
use watchit_core::AppResult;

use crate::clock::{DAY_MS, day, now_ms};
use crate::model::{CatalogKind, TrendingEntry, TrendingPage};
use crate::store::browse::{IdFilter, kind_condition, trending_column};
use crate::store::entry::{ENTRY_COLUMNS, ENTRY_WIDTH, EntryRow, PAGE_SIZE, images, offset};

const HISTORY_DAYS: i64 = 30;

pub(crate) fn save(conn: &Connection, kind: CatalogKind, ids: &[String]) -> AppResult<()> {
    let column = trending_column(kind);
    let now = now_ms();
    let today = day(now);
    conn.execute(
        "DELETE FROM trending WHERE kind = ?1 AND (day = ?2 OR day < ?3)",
        params![kind.as_str(), today, day(now - HISTORY_DAYS * DAY_MS)],
    )?;
    conn.execute(
        &format!(
            "UPDATE titles SET {column} = NULL WHERE {column} IS NOT NULL AND {}",
            kind_condition(kind)
        ),
        [],
    )?;
    let mut history = conn.prepare_cached("INSERT INTO trending (kind, day, rank, id) VALUES (?1, ?2, ?3, ?4)")?;
    let mut rank = conn.prepare_cached(&format!("UPDATE titles SET {column} = ?1 WHERE id = ?2"))?;
    for (index, id) in ids.iter().enumerate() {
        let position = index as i64 + 1;
        history.execute(params![kind.as_str(), today, position, id])?;
        rank.execute(params![position, id])?;
    }
    Ok(())
}

pub(crate) fn page(conn: &Connection, artwork: &Artwork, kind: CatalogKind, page: u32, filter: Option<&IdFilter>) -> AppResult<TrendingPage> {
    let column = trending_column(kind);
    let mut parameters = Vec::new();
    let hidden = filter.map(|filter| filter.condition(&mut parameters)).unwrap_or("1");
    parameters.push(Value::Integer(PAGE_SIZE as i64 + 1));
    parameters.push(Value::Integer(offset(page)));
    let sql = format!(
        "SELECT {ENTRY_COLUMNS}, titles.{column} FROM titles WHERE titles.{column} IS NOT NULL AND {} AND {hidden}
         ORDER BY titles.{column}, titles.kind DESC, titles.id LIMIT ? OFFSET ?",
        kind_condition(kind)
    );
    let mut statement = conn.prepare_cached(&sql)?;
    let mut rows: Vec<(EntryRow, i64)> = statement
        .query_map(rusqlite::params_from_iter(parameters), |row| {
            Ok((EntryRow::read(row)?, row.get(ENTRY_WIDTH)?))
        })?
        .collect::<rusqlite::Result<_>>()?;
    let has_next = rows.len() > PAGE_SIZE;
    rows.truncate(PAGE_SIZE);
    let images = images(conn, artwork, rows.iter().map(|(row, _)| row))?;
    let kinds: &[&str] = if kind == CatalogKind::All {
        &["movie", "series"]
    } else {
        &[kind.as_str()]
    };
    let mut latest: Option<String> = None;
    for list in kinds {
        let day: Option<String> = conn
            .prepare_cached("SELECT MAX(day) FROM trending WHERE kind = ?1")?
            .query_row([list], |row| row.get(0))?;
        latest = latest.max(day);
    }
    Ok(TrendingPage {
        items: rows
            .iter()
            .map(|(row, rank)| TrendingEntry {
                entry: row.entry(&images),
                rank: *rank,
            })
            .collect(),
        page,
        has_next,
        day: latest,
        artwork_status: images.status,
    })
}
