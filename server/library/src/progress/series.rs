use rusqlite::{Connection, OptionalExtension, params};
use watchit_catalog::{Catalog, EpisodeEntry, SeriesProgress};
use watchit_core::AppResult;

use super::store::get;
use crate::ids::episode_position;

struct Opened {
    id: String,
    opened_at: String,
    unfinished: bool,
}

type Position = (i64, i64, String);

fn last_opened(conn: &Connection, profile: i64, series_id: &str) -> AppResult<Option<Opened>> {
    let found = conn
        .prepare_cached(
            "SELECT e.id, e.opened_at, w.id IS NOT NULL
             FROM library_entries e LEFT JOIN watch_progress w ON w.profile_id = e.profile_id AND w.id = e.id
             WHERE e.profile_id = ?1 AND e.series_id = ?2 AND e.opened_at IS NOT NULL
             ORDER BY e.opened_at DESC LIMIT 1",
        )?
        .query_row(params![profile, series_id], |row| Ok(Opened { id: row.get(0)?, opened_at: row.get(1)?, unfinished: row.get(2)? }))
        .optional()?;
    Ok(found)
}

fn furthest(conn: &Connection, profile: i64, series_id: &str, last_id: Option<&str>) -> AppResult<Option<Position>> {
    let mut statement = conn.prepare_cached(
        "SELECT id, COALESCE(id = ?3, 0) FROM library_entries WHERE profile_id = ?1 AND series_id = ?2 AND (id = ?3 OR status = 'watched')",
    )?;
    let rows = statement.query_map(params![profile, series_id, last_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?)))?;
    let mut best: Option<Position> = None;
    for row in rows {
        let (id, is_last) = row?;
        let Some((season, episode)) = episode_position(&id) else { continue };
        if season == 0 && !is_last {
            continue;
        }
        if best.as_ref().is_none_or(|(s, e, other)| (season, episode, &id) > (*s, *e, other)) {
            best = Some((season, episode, id));
        }
    }
    Ok(best)
}

fn episode(conn: &Connection, catalog: &Catalog, id: &str) -> AppResult<Option<EpisodeEntry>> {
    Ok(catalog.episode_entries(conn, &[id.to_owned()])?.0.into_iter().next())
}

pub fn series_progress(conn: &Connection, catalog: &Catalog, profile: i64, series_id: &str) -> AppResult<SeriesProgress> {
    let opened = last_opened(conn, profile, series_id)?;
    let last = opened.as_ref().map(|opened| episode(conn, catalog, &opened.id)).transpose()?.flatten();
    let next = match (&opened, &last) {
        (Some(opened), Some(last)) if opened.unfinished => Some(last.clone()),
        _ => match furthest(conn, profile, series_id, opened.as_ref().map(|opened| opened.id.as_str()))? {
            Some((season, episode, id)) => catalog.next_episode(conn, series_id, Some((season, episode, &id)))?,
            None => catalog.next_episode(conn, series_id, None)?,
        },
    };
    let resume = next.as_ref().map(|next| get(conn, profile, &next.entry.id)).transpose()?.flatten();
    let opened_at = last.as_ref().and(opened.map(|opened| opened.opened_at));
    Ok(SeriesProgress { last, next, resume, opened_at })
}
