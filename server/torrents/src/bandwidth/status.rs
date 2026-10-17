use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/")]
pub enum WhileWatching {
    Pause,
    Throttle,
    None,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/")]
pub enum SpeedMode {
    Normal,
    Alternative,
    Watching,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct SpeedStatus {
    pub mode: SpeedMode,
    pub alternative: bool,
    pub download_bps_limit: Option<u32>,
    pub upload_bps_limit: Option<u32>,
}
