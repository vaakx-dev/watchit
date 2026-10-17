pub(crate) mod franchises;
mod wikidata;

use std::collections::HashSet;

use rusqlite::Connection;
use watchit_core::AppResult;

use crate::model::{Franchise, FranchiseEntry, MediaKind, RelatedTitles};
use crate::service::Catalog;
use crate::store::entry::images;
use crate::store::record::Record;
use crate::store::similar::similar;
use crate::store::titles;

const REACH: usize = 7;

impl Catalog {
    pub(crate) fn related(&self, conn: &Connection, title: &Record, settled: &HashSet<String>) -> AppResult<RelatedTitles> {
        let inner = &self.inner;
        let lookup = match (&title.detail.imdb_id, title.kind) {
            (Some(imdb_id), MediaKind::Movie | MediaKind::Series) => Some(inner.franchises.get(conn, imdb_id)?),
            _ => None,
        };
        let pending = lookup.as_ref().is_some_and(|lookup| lookup.pending);
        let franchise = lookup.and_then(|lookup| lookup.franchise);
        let ids = franchise.as_ref().map(|franchise| franchise.ids.clone()).unwrap_or_default();
        let start = ids.iter().position(|id| *id == title.id).map_or(0, |index| index.saturating_sub(REACH));
        let shown: Vec<String> = ids.iter().skip(start).take(REACH * 2 + 1).cloned().collect();
        let members = titles::rows(conn, &shown)?;
        let missing: Vec<String> = shown.iter().filter(|id| members.iter().all(|row| &row.id != *id)).cloned().collect();
        for id in &missing {
            inner.sync.title(conn, id)?;
        }
        let similar = similar(conn, title, &ids, settled)?;
        let images = images(conn, &inner.artwork, members.iter().chain(similar.iter()))?;
        let items: Vec<FranchiseEntry> = shown
            .iter()
            .enumerate()
            .filter_map(|(offset, id)| {
                let row = members.iter().find(|row| &row.id == id)?;
                Some(FranchiseEntry { entry: row.entry(&images), position: start + offset + 1, current: *id == title.id })
            })
            .collect();
        Ok(RelatedTitles {
            franchise: franchise.filter(|_| items.len() > 1).map(|franchise| Franchise { name: franchise.name, items }),
            similar: similar.iter().map(|row| row.entry(&images)).collect(),
            pending: pending || (!missing.is_empty() && inner.sync.titles(&missing).pending),
            artwork_status: images.status,
        })
    }
}
