use std::collections::HashMap;
use std::path::PathBuf;

use super::admission::Admission;
use crate::locations::root_of;
use crate::settings::Settings;
use crate::transfers::model::Kind;
use crate::transfers::{Entry, Progress};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Slot {
    #[default]
    Resolving,
    Paused,
    Watching,
    Streaming,
    Seeding,
    Finished,
    Active,
    Queued(Option<&'static str>),
}

impl Slot {
    pub fn runs(self) -> bool {
        matches!(self, Self::Watching | Self::Streaming | Self::Seeding | Self::Active)
    }

    pub fn waiting(self) -> Option<&'static str> {
        match self {
            Self::Queued(reason) => reason,
            _ => None,
        }
    }
}

fn seeding_done(entry: &Entry, progress: &Progress, settings: &Settings) -> bool {
    let ratio = if progress.size_bytes == 0 { 0.0 } else { entry.record.uploaded_bytes as f64 / progress.size_bytes as f64 };
    settings.seeding_done(ratio, entry.record.seeded_seconds / 60)
}

fn slot(entry: &Entry, settings: &Settings, admission: &mut Admission) -> Slot {
    let progress = entry.progress();
    if entry.handle.is_none() {
        Slot::Resolving
    } else if entry.record.paused {
        Slot::Paused
    } else if entry.readers > 0 {
        Slot::Watching
    } else if progress.finished() {
        if seeding_done(entry, &progress, settings) { Slot::Finished } else { Slot::Seeding }
    } else if entry.record.kind == Kind::Stream {
        Slot::Streaming
    } else {
        match admission.admit(&root_of(&entry.record.download_dir), progress.remaining()) {
            Ok(()) => Slot::Active,
            Err(reason) => Slot::Queued(reason),
        }
    }
}

pub fn used_by_drive(entries: &HashMap<String, Entry>) -> HashMap<PathBuf, u64> {
    let mut used: HashMap<PathBuf, u64> = HashMap::new();
    for entry in entries.values() {
        *used.entry(root_of(&entry.record.download_dir)).or_insert(0) += entry.progress().downloaded_bytes;
    }
    used
}

pub fn assign_slots(entries: &mut HashMap<String, Entry>, settings: &Settings, used: HashMap<PathBuf, u64>) {
    let mut admission = Admission::new(settings, used);
    let mut line: Vec<&mut Entry> = entries.values_mut().collect();
    line.sort_by_key(|entry| (entry.queue_rank, entry.record.added_at));
    for entry in line {
        entry.slot = slot(entry, settings, &mut admission);
    }
}
