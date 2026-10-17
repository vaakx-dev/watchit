use serde::{Deserialize, Serialize};

use super::model::Kind;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "choice", rename_all = "snake_case")]
pub enum Choice {
    Files { indexes: Vec<usize> },
    All,
    Main,
    Season { season: u32 },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Pick {
    pub title_id: String,
    pub choice: Choice,
}

impl Pick {
    pub fn files_or(title_id: &str, file_indexes: Option<Vec<usize>>, fallback: Choice) -> Self {
        let choice = file_indexes.map_or(fallback, |indexes| Choice::Files { indexes });
        Self { title_id: title_id.to_owned(), choice }
    }
}

#[derive(Clone, Debug)]
pub struct Record {
    pub info_hash: String,
    pub name: String,
    pub title_id: String,
    pub kind: Kind,
    pub paused: bool,
    pub added_at: i64,
    pub last_used_at: i64,
    pub uploaded_bytes: u64,
    pub seeded_seconds: u64,
    pub trackers: Vec<String>,
    pub error: Option<String>,
    pub picks: Vec<Pick>,
    pub notify_when_ready: bool,
}

#[derive(Clone, Debug)]
pub struct FileRecord {
    pub index: usize,
    pub name: String,
    pub size_bytes: u64,
    pub title_id: Option<String>,
}
