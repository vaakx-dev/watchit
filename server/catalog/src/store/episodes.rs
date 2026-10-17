use rusqlite::{Connection, OptionalExtension, params};
use watchit_artwork::Artwork;
use watchit_core::AppResult;

use crate::model::{EpisodeNavigation, EpisodePage};
use crate::store::entry::{ENTRY_COLUMNS, EntryRow, PAGE_SIZE, freshness, images, offset, page_rows};

const EPISODES: &str = "FROM titles WHERE titles.kind = 'episode' AND titles.series_id = ?1";
const NUMBERED: &str = "titles.season IS NOT NULL AND titles.episode IS NOT NULL";
const RANK: &str = "titles.season, titles.episode, titles.id";
const RANK_DESC: &str = "titles.season DESC, titles.episode DESC, titles.id DESC";

pub(crate) struct Position {
    pub series_id: String,
    pub season: i64,
    pub episode: i64,
    pub id: String,
}

pub(crate) fn page(conn: &Connection, artwork: &Artwork, series_id: &str, page: u32, metadata_ms: i64) -> AppResult<EpisodePage> {
    let sql = format!(
        "SELECT {ENTRY_COLUMNS} {EPISODES}
         ORDER BY titles.season IS NULL, titles.season, titles.episode IS NULL, titles.episode, titles.id LIMIT ?2 OFFSET ?3"
    );
    let (rows, has_next) = page_rows(&mut *conn.prepare_cached(&sql)?, params![series_id, PAGE_SIZE as i64 + 1, offset(page)])?;
    let images = images(conn, artwork, &rows)?;
    Ok(EpisodePage {
        items: rows.iter().map(|row| row.episode(&images)).collect(),
        page,
        has_next,
        freshness: freshness(&rows, metadata_ms),
        artwork_status: images.status,
    })
}

pub(crate) fn position(conn: &Connection, id: &str) -> AppResult<Option<Position>> {
    Ok(conn
        .prepare_cached("SELECT series_id, season, episode FROM titles WHERE id = ?1 AND kind = 'episode'")?
        .query_row([id], |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<i64>>(1)?, row.get::<_, Option<i64>>(2)?)))
        .optional()?
        .and_then(|(series_id, season, episode)| Some(Position { series_id: series_id?, season: season?, episode: episode?, id: id.to_owned() })))
}

pub(crate) fn neighbour(conn: &Connection, at: &Position, later: bool) -> AppResult<Option<EntryRow>> {
    let (comparison, order) = if later { (">", RANK) } else { ("<", RANK_DESC) };
    let sql = format!("SELECT {ENTRY_COLUMNS} {EPISODES} AND {NUMBERED} AND ({RANK}) {comparison} (?2, ?3, ?4) ORDER BY {order} LIMIT 1");
    Ok(conn.prepare_cached(&sql)?.query_row(params![at.series_id, at.season, at.episode, at.id], EntryRow::read).optional()?)
}

pub(crate) fn first(conn: &Connection, series_id: &str) -> AppResult<Option<EntryRow>> {
    let sql = format!("SELECT {ENTRY_COLUMNS} {EPISODES} AND {NUMBERED} ORDER BY titles.season = 0, {RANK} LIMIT 1");
    Ok(conn.prepare_cached(&sql)?.query_row([series_id], EntryRow::read).optional()?)
}

pub(crate) fn season_ids(conn: &Connection, series_id: &str, season: i64) -> AppResult<Vec<String>> {
    let sql = format!("SELECT titles.id {EPISODES} AND titles.season = ?2 ORDER BY {RANK}");
    let mut statement = conn.prepare_cached(&sql)?;
    let rows = statement.query_map(params![series_id, season], |row| row.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub(crate) fn navigation(
    conn: &Connection,
    artwork: &Artwork,
    id: &str,
    season: Option<i64>,
    page: Option<u32>,
    metadata_ms: i64,
) -> AppResult<Option<EpisodeNavigation>> {
    let Some(current) = position(conn, id)? else { return Ok(None) };
    let selected = season.unwrap_or(current.season);
    let selected_page = match page {
        Some(page) => page,
        None if selected == current.season => {
            let sql = format!("SELECT COUNT(*) {EPISODES} AND titles.season = ?2 AND titles.episode IS NOT NULL AND ({RANK}) <= (?3, ?4, ?5)");
            let rank: i64 = conn
                .prepare_cached(&sql)?
                .query_row(params![current.series_id, selected, current.season, current.episode, current.id], |row| row.get(0))?;
            u32::try_from((rank.max(1) + PAGE_SIZE as i64 - 1) / PAGE_SIZE as i64).unwrap_or(1)
        }
        None => 1,
    };
    let sql = format!("SELECT {ENTRY_COLUMNS} {EPISODES} AND titles.season = ?2 AND titles.episode IS NOT NULL ORDER BY {RANK} LIMIT ?3 OFFSET ?4");
    let (rows, has_next) =
        page_rows(&mut *conn.prepare_cached(&sql)?, params![current.series_id, selected, PAGE_SIZE as i64 + 1, offset(selected_page)])?;
    let previous = neighbour(conn, &current, false)?;
    let next = neighbour(conn, &current, true)?;
    let sql = format!("SELECT DISTINCT titles.season {EPISODES} AND {NUMBERED} ORDER BY titles.season");
    let mut statement = conn.prepare_cached(&sql)?;
    let seasons = statement.query_map([&current.series_id], |row| row.get(0))?.collect::<rusqlite::Result<Vec<i64>>>()?;
    let images = images(conn, artwork, rows.iter().chain(previous.iter()).chain(next.iter()))?;
    Ok(Some(EpisodeNavigation {
        page: EpisodePage {
            items: rows.iter().map(|row| row.episode(&images)).collect(),
            page: selected_page,
            has_next,
            freshness: freshness(&rows, metadata_ms),
            artwork_status: images.status.clone(),
        },
        season: selected,
        seasons,
        previous: previous.map(|row| row.episode(&images)),
        next: next.map(|row| row.episode(&images)),
    }))
}
