use serde::Serialize;
use ts_rs::TS;

use crate::profile::Profile;

#[derive(Serialize, TS)]
#[ts(export_to = "profiles/")]
pub struct ProfileSession {
    pub token: String,
    pub profile: Profile,
}

#[derive(Serialize, TS)]
#[ts(export_to = "profiles/")]
pub struct SessionState {
    pub profile: Option<Profile>,
}
