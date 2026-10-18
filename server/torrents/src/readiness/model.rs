use serde::Serialize;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/", rename = "ReadyState")]
pub enum Verdict {
    Ready,
    Waiting,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct Readiness {
    pub state: Verdict,
    pub ready_in_seconds: Option<u64>,
    pub bitrate_bps: Option<u64>,
}

impl Readiness {
    pub const UNKNOWN: Self = Self {
        state: Verdict::Unknown,
        ready_in_seconds: None,
        bitrate_bps: None,
    };
}

impl Default for Readiness {
    fn default() -> Self {
        Self::UNKNOWN
    }
}
