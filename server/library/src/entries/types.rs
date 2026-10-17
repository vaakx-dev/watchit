use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_artwork::ArtworkStatus;
use watchit_catalog::CatalogEntry;

use crate::present::present;
use crate::rating::Rating;
use crate::status::Status;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "library/")]
pub struct PersonalEntry {
    pub id: String,
    pub rating: Option<Rating>,
    pub status: Option<Status>,
    pub favorite: bool,
    pub recommended: bool,
    pub saved: bool,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Default, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct PersonalPatch {
    #[serde(default, deserialize_with = "present")]
    #[ts(optional = nullable, as = "Option<Rating>")]
    pub rating: Option<Option<Rating>>,
    #[serde(default, deserialize_with = "present")]
    #[ts(optional = nullable, as = "Option<Status>")]
    pub status: Option<Option<Status>>,
    #[serde(default)]
    #[ts(optional)]
    pub favorite: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    pub recommended: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    pub saved: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    pub opened: Option<bool>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct LibrarySnapshot {
    pub entries: BTreeMap<String, PersonalEntry>,
    pub seasons: BTreeMap<String, BTreeMap<i64, Rating>>,
    pub saved: Vec<CatalogEntry>,
    pub recent: Vec<CatalogEntry>,
    pub artwork_status: ArtworkStatus,
}
