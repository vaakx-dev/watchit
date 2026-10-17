use std::collections::HashMap;

use rusqlite::Connection;
use watchit_artwork::ArtworkStatus;
use watchit_catalog::{Catalog, MediaKind};
use watchit_core::AppResult;

use super::types::LibraryItem;
use crate::progress::series_progress;
use crate::titles::LibraryRow;

pub fn build_items(conn: &Connection, catalog: &Catalog, profile: i64, rows: &[LibraryRow]) -> AppResult<(Vec<LibraryItem>, ArtworkStatus)> {
    let ids: Vec<String> = rows.iter().map(|row| row.id.clone()).collect();
    let (entries, artwork_status) = catalog.entries(conn, &ids)?;
    let mut by_id: HashMap<String, _> = entries.into_iter().map(|entry| (entry.id.clone(), entry)).collect();
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let Some(title) = by_id.remove(&row.id) else { continue };
        let progress = (row.kind == MediaKind::Series).then(|| series_progress(conn, catalog, profile, &row.id)).transpose()?;
        items.push(LibraryItem { title, entry: row.entry(), opened_at: row.opened_at.clone(), progress, resume: row.resume });
    }
    Ok((items, artwork_status))
}
