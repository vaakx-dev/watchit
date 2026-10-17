use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export_to = "profiles/")]
pub enum Avatar {
    Eyes { seed: i64 },
    Image { url: String },
}

#[derive(Serialize, TS)]
#[ts(export_to = "profiles/")]
pub struct Profile {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub is_admin: bool,
    pub has_pin: bool,
    pub avatar: Avatar,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "profiles/")]
pub struct ProfilePatch {
    #[serde(default)]
    #[ts(optional)]
    pub name: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub is_admin: Option<bool>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewProfile {
    pub name: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteProfile {
    pub confirm: String,
}
