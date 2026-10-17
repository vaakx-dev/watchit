use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::readiness::Readiness;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/", rename = "TransferKind")]
pub enum Kind {
    Stream,
    Download,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stream => "stream",
            Self::Download => "download",
        }
    }

    pub fn parse(value: &str) -> Self {
        if value == "download" { Self::Download } else { Self::Stream }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/", rename = "TransferState")]
pub enum State {
    Metadata,
    Queued,
    Downloading,
    Paused,
    Seeding,
    Completed,
    Error,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct TransferFile {
    pub index: usize,
    pub name: String,
    pub size_bytes: u64,
    pub progress: f64,
    pub title_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct Transfer {
    pub id: String,
    pub info_hash: String,
    pub name: String,
    pub title_id: String,
    pub kind: Kind,
    pub state: State,
    pub error: Option<String>,
    pub files: Vec<TransferFile>,
    pub size_bytes: u64,
    pub downloaded_bytes: u64,
    pub progress: f64,
    pub download_bps: u64,
    pub upload_bps: u64,
    pub peers: u32,
    pub eta_seconds: Option<u64>,
    pub added_at: i64,
    pub readiness: Readiness,
}
