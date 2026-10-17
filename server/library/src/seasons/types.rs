use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_catalog::SeriesProgress;

use crate::entries::LibrarySnapshot;
use crate::present::present;
use crate::rating::Rating;

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct SeasonPatch {
    #[serde(default, deserialize_with = "present")]
    #[ts(optional = nullable, as = "Option<Rating>")]
    pub rating: Option<Option<Rating>>,
    #[serde(default)]
    #[ts(optional)]
    pub watched: Option<bool>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct SeasonWatched {
    #[serde(flatten)]
    pub snapshot: LibrarySnapshot,
    pub progress: SeriesProgress,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum SeasonResponse {
    Rated(LibrarySnapshot),
    Watched(Box<SeasonWatched>),
}
