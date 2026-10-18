use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct RecentSearches {
    pub searches: Vec<String>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct NewSearch {
    pub query: String,
}
