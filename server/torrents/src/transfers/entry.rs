use std::collections::BTreeSet;

use librqbit::{TorrentStats, TorrentStatsState};
use tokio::task::AbortHandle;

use super::model::Transfer;
use super::record::{FileRecord, Record};
use crate::engine::Handle;
use crate::queue::Slot;
use crate::readiness::Tracker;
use crate::locations::Moving;

pub struct Entry {
    pub record: Record,
    pub files: Vec<FileRecord>,
    pub handle: Option<Handle>,
    pub resolving: Option<AbortHandle>,
    pub readers: usize,
    pub live_uploaded: u64,
    pub seeding_millis: u64,
    pub slot: Slot,
    pub queue_rank: i64,
    pub queue_position: Option<u32>,
    pub focus: Option<usize>,
    pub sent: Option<Transfer>,
    pub readiness: Tracker,
    pub relocation: Option<Moving>,
    pub move_error: Option<String>,
}

pub struct Progress {
    pub size_bytes: u64,
    pub downloaded_bytes: u64,
    pub per_file: Vec<(usize, u64)>,
    pub stats: Option<TorrentStats>,
}

impl Entry {
    pub fn new(record: Record, files: Vec<FileRecord>) -> Self {
        Self {
            record,
            files,
            handle: None,
            resolving: None,
            readers: 0,
            live_uploaded: 0,
            seeding_millis: 0,
            slot: Slot::default(),
            queue_rank: 0,
            queue_position: None,
            focus: None,
            sent: None,
            readiness: Tracker::default(),
            relocation: None,
            move_error: None,
        }
    }

    pub fn selected(&self) -> BTreeSet<usize> {
        self.files.iter().map(|file| file.index).collect()
    }

    pub fn progress(&self) -> Progress {
        let stats = self.handle.as_ref().map(|handle| handle.stats());
        let have = stats.as_ref().map(|stats| stats.file_progress.as_slice()).unwrap_or_default();
        let per_file: Vec<(usize, u64)> =
            self.files.iter().map(|file| (file.index, have.get(file.index).copied().unwrap_or(0).min(file.size_bytes))).collect();
        Progress {
            size_bytes: self.files.iter().map(|file| file.size_bytes).sum(),
            downloaded_bytes: per_file.iter().map(|(_, bytes)| bytes).sum(),
            per_file,
            stats,
        }
    }

    pub fn file_complete(&self, index: usize) -> bool {
        let Some(file) = self.files.iter().find(|file| file.index == index) else { return false };
        self.handle
            .as_ref()
            .and_then(|handle| handle.stats().file_progress.get(index).copied())
            .is_some_and(|have| have >= file.size_bytes)
    }
}

impl Progress {
    pub fn finished(&self) -> bool {
        self.size_bytes > 0 && self.downloaded_bytes >= self.size_bytes
    }

    pub fn remaining(&self) -> u64 {
        self.size_bytes.saturating_sub(self.downloaded_bytes)
    }

    pub fn engine_state(&self) -> Option<TorrentStatsState> {
        self.stats.as_ref().map(|stats| stats.state)
    }

    pub fn is_live(&self) -> bool {
        matches!(self.engine_state(), Some(TorrentStatsState::Live))
    }
}
