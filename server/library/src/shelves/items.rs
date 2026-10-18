use std::collections::HashMap;

use rusqlite::Connection;
use watchit_artwork::ArtworkStatus;
use watchit_catalog::{Catalog, MediaKind, SeriesProgress};
use watchit_core::AppResult;

use super::types::LibraryItem;
use crate::progress::series_progress;
use crate::titles::LibraryRow;

struct Length {
    minutes: Option<u32>,
    seasons: Option<i64>,
    season_episodes: Option<i64>,
}

fn length(conn: &Connection, catalog: &Catalog, row: &LibraryRow, progress: Option<&SeriesProgress>) -> AppResult<Length> {
    if row.kind != MediaKind::Series {
        return Ok(Length { minutes: catalog.runtime_minutes(conn, &row.id)?, seasons: None, season_episodes: None });
    }
    let seasons = catalog.season_count(conn, &row.id)?;
    if seasons == 0 {
        catalog.episodes_pending(conn, &row.id)?;
    }
    let season_episodes = match progress.and_then(|progress| progress.next.as_ref()).and_then(|next| next.season) {
        Some(season) => Some(catalog.season_episodes(conn, &row.id, season)?.len() as i64),
        None => None,
    };
    Ok(Length { minutes: None, seasons: (seasons > 0).then_some(seasons), season_episodes })
}

pub fn build_items(conn: &Connection, catalog: &Catalog, profile: i64, rows: &[LibraryRow]) -> AppResult<(Vec<LibraryItem>, ArtworkStatus)> {
    let ids: Vec<String> = rows.iter().map(|row| row.id.clone()).collect();
    let (entries, artwork_status) = catalog.entries(conn, &ids)?;
    let mut by_id: HashMap<String, _> = entries.into_iter().map(|entry| (entry.id.clone(), entry)).collect();
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let Some(title) = by_id.remove(&row.id) else { continue };
        let progress = (row.kind == MediaKind::Series).then(|| series_progress(conn, catalog, profile, &row.id)).transpose()?;
        let Length { minutes, seasons, season_episodes } = length(conn, catalog, row, progress.as_ref())?;
        items.push(LibraryItem {
            title,
            entry: row.entry(),
            opened_at: row.opened_at.clone(),
            progress,
            resume: row.resume,
            status_changed_at: row.status_changed_at.clone(),
            minutes,
            seasons,
            season_episodes,
        });
    }
    Ok((items, artwork_status))
}
