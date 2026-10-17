use serde::Serialize;
use ts_rs::TS;
use watchit_artwork::ArtworkStatus;
use watchit_catalog::{CatalogEntry, SavedPosition, SeriesProgress};

use crate::entries::PersonalEntry;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "library/")]
pub struct LibraryItem {
    pub title: CatalogEntry,
    pub entry: PersonalEntry,
    pub opened_at: Option<String>,
    pub progress: Option<SeriesProgress>,
    pub position: Option<SavedPosition>,
}

#[derive(Debug, Default, Serialize, TS)]
#[ts(export_to = "library/")]
pub struct ShelfCounts {
    pub want: i64,
    pub watching: i64,
    pub paused: i64,
    pub watched: i64,
    pub dropped: i64,
    pub favorite: i64,
    pub recommended: i64,
    pub saved: i64,
    pub recent: i64,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct LibraryPage {
    pub items: Vec<LibraryItem>,
    pub page: u32,
    pub has_next: bool,
    pub total: i64,
    pub counts: ShelfCounts,
    pub artwork_status: ArtworkStatus,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct ContinuePage {
    pub items: Vec<LibraryItem>,
    pub page: u32,
    pub has_next: bool,
    pub artwork_status: ArtworkStatus,
}
