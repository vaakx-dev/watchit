use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export_to = "remote/")]
pub enum TailscaleState {
    Missing,
    Stopped,
    NeedsLogin,
    NeedsApproval,
    Connecting,
    NoHttps,
    Ready,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export_to = "remote/")]
pub enum Sharing {
    Off,
    On,
    Elsewhere,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "remote/")]
pub struct TailscaleStatus {
    pub state: TailscaleState,
    pub name: Option<String>,
    pub ip: Option<String>,
    pub login_url: Option<String>,
    pub sharing: Sharing,
    pub public: bool,
}

#[derive(Deserialize, TS)]
#[ts(export_to = "remote/")]
pub struct SharingChange {
    pub enabled: bool,
}

impl TailscaleStatus {
    pub fn new(state: TailscaleState) -> Self {
        Self { state, name: None, ip: None, login_url: None, sharing: Sharing::Off, public: false }
    }
}
