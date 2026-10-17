use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::present::required;

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct PlaybackPreference {
    pub id: String,
    pub source: Option<String>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct SourcePatch {
    #[serde(deserialize_with = "required")]
    pub source: Option<String>,
}
