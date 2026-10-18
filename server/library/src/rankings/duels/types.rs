use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_catalog::{CatalogEntry, CatalogKind};

use crate::present::required;

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct Contender {
    pub title: CatalogEntry,
    pub rating: i64,
    pub gain: i64,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct DuelStanding {
    pub title: CatalogEntry,
    pub rank: usize,
    pub rating: i64,
    pub games: i64,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct DuelBoard {
    pub kind: CatalogKind,
    pub pair: Vec<Contender>,
    pub top: Vec<DuelStanding>,
    pub can_undo: bool,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct DuelRanking {
    pub kind: CatalogKind,
    pub items: Vec<DuelStanding>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct DuelResult {
    pub first: String,
    pub second: String,
    #[serde(deserialize_with = "required")]
    pub winner: Option<String>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct DuelPair {
    pub first: String,
    pub second: String,
}
