use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_catalog::{CatalogEntry, CatalogKind};

use crate::present::required;
use crate::rating::Rating;
use crate::shelves::LibraryItem;

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct RankedItem {
    #[serde(flatten)]
    pub item: LibraryItem,
    pub rank: usize,
    pub position: usize,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct RankingTier {
    pub rating: Rating,
    pub items: Vec<RankedItem>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct Rankings {
    pub kind: CatalogKind,
    pub tiers: Vec<RankingTier>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct RankingMove {
    #[serde(deserialize_with = "required")]
    pub before: Option<String>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct UnratedTitles {
    pub kind: CatalogKind,
    pub titles: Vec<CatalogEntry>,
}
