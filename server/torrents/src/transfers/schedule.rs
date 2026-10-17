use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::future::Future;
use std::time::{Duration, Instant};

use librqbit::TorrentStatsState;

use super::Transfers;
use super::entry::{Entry, Progress};
use super::model::Kind;
use crate::engine::Handle;
use crate::locations::{free_bytes, root_of};
use crate::settings::Settings;

const TICK: Duration = Duration::from_secs(1);
const PERSIST_EVERY: u32 = 15;
const WAITING_FOR_BUDGET: &str = "Waiting for room in the disk budget.";
const WAITING_FOR_DISK: &str = "Waiting for free disk space.";

enum Action {
    Pause(Handle),
    Resume(Handle),
    SelectFiles(Handle, HashSet<usize>),
    Evict(String),
}

struct Room {
    budget: Option<u64>,
    disk: u64,
}

struct Admission {
    slots: u32,
    budget_bytes: Option<u64>,
    used: BTreeMap<PathBuf, u64>,
    drives: HashMap<PathBuf, Room>,
}

impl Admission {
    fn new(settings: &Settings, used: BTreeMap<PathBuf, u64>) -> Self {
        Self { slots: settings.max_active, budget_bytes: settings.disk_budget_bytes, used, drives: HashMap::new() }
    }

    fn room(&mut self, drive: &Path) -> &mut Room {
        self.drives.entry(drive.to_path_buf()).or_insert_with(|| {
            let used = self.used.get(drive).copied().unwrap_or(0);
            Room { budget: self.budget_bytes.map(|budget| budget.saturating_sub(used)), disk: free_bytes(drive) }
        })
    }

    fn admit(&mut self, drive: &Path, remaining: u64) -> Result<(), Option<&'static str>> {
        if self.slots == 0 {
            return Err(None);
        }
        let room = self.room(drive);
        if room.budget.is_some_and(|budget| remaining > budget) {
            return Err(Some(WAITING_FOR_BUDGET));
        }
        if remaining > room.disk {
            return Err(Some(WAITING_FOR_DISK));
        }
        room.budget = room.budget.map(|budget| budget - remaining);
        room.disk -= remaining;
        self.slots -= 1;
        Ok(())
    }
}

fn seeding_done(entry: &Entry, progress: &Progress, settings: &Settings) -> bool {
    let ratio = if progress.size_bytes == 0 { 0.0 } else { entry.record.uploaded_bytes as f64 / progress.size_bytes as f64 };
    settings.seeding_done(ratio, entry.record.seeded_seconds / 60)
}

impl Transfers {
    pub async fn run_scheduler(&self, stopping: impl Future<Output = ()>) {
        tokio::pin!(stopping);
        let mut last = Instant::now();
        let mut ticks = 0u32;
        loop {
            tokio::select! {
                _ = &mut stopping => break,
                _ = tokio::time::sleep(TICK) => {}
                _ = self.wake.notified() => {}
            }
            let elapsed = last.elapsed();
            last = Instant::now();
            self.account(elapsed);
            self.reconcile().await;
            ticks += 1;
            if ticks.is_multiple_of(PERSIST_EVERY) {
                self.persist_all().await;
            }
        }
        self.persist_all().await;
    }

    fn account(&self, elapsed: Duration) {
        for entry in self.entries().values_mut() {
            let progress = entry.progress();
            let uploaded = progress.stats.as_ref().map_or(0, |stats| stats.uploaded_bytes);
            let delta = if uploaded >= entry.live_uploaded { uploaded - entry.live_uploaded } else { uploaded };
            entry.live_uploaded = uploaded;
            entry.record.uploaded_bytes += delta;
            if progress.is_live() && progress.finished() {
                entry.seeding_millis += elapsed.as_millis() as u64;
                entry.record.seeded_seconds += entry.seeding_millis / 1000;
                entry.seeding_millis %= 1000;
            }
        }
    }

    pub async fn persist_all(&self) {
        let hashes: Vec<String> = self.entries().keys().cloned().collect();
        for hash in hashes {
            if let Err(error) = self.persist(&hash).await {
                tracing::warn!(%hash, %error, "could not save transfer");
            }
        }
    }

    fn plan(&self) -> Vec<Action> {
        let settings = self.settings();
        let mut entries = self.entries();
        let mut used: BTreeMap<PathBuf, u64> = BTreeMap::new();
        for entry in entries.values() {
            *used.entry(root_of(&entry.record.download_dir)).or_insert(0) += entry.progress().downloaded_bytes;
        }
        let mut admission = Admission::new(&settings, used.clone());
        let mut actions = Vec::new();

        let mut queue: Vec<&mut Entry> = entries.values_mut().filter(|entry| entry.handle.is_some()).collect();
        queue.sort_by_key(|entry| entry.record.added_at);
        for entry in queue {
            let Some(handle) = entry.handle.clone() else { continue };
            let progress = entry.progress();
            let engine = progress.engine_state();
            let selected: BTreeSet<usize> = entry.selected();
            let engine_selected: Option<BTreeSet<usize>> = handle.only_files().map(|files| files.into_iter().collect());
            if !matches!(engine, Some(TorrentStatsState::Initializing { .. })) && engine_selected.as_ref() != Some(&selected) {
                actions.push(Action::SelectFiles(handle.clone(), selected.into_iter().collect()));
            }
            entry.waiting = None;
            let run = if entry.record.paused {
                false
            } else if entry.readers > 0 {
                true
            } else if progress.finished() {
                !seeding_done(entry, &progress, &settings)
            } else if entry.record.kind == Kind::Stream {
                true
            } else {
                match admission.admit(&root_of(&entry.record.download_dir), progress.remaining()) {
                    Ok(()) => true,
                    Err(reason) => {
                        entry.waiting = reason;
                        false
                    }
                }
            };
            match (engine, run) {
                (Some(TorrentStatsState::Live), false) => actions.push(Action::Pause(handle)),
                (Some(TorrentStatsState::Paused), true) => actions.push(Action::Resume(handle)),
                _ => {}
            }
        }

        if let Some(budget) = settings.disk_budget_bytes {
            let mut over: HashMap<PathBuf, u64> = used.into_iter().map(|(drive, bytes)| (drive, bytes.saturating_sub(budget))).collect();
            let mut evictable: Vec<&Entry> =
                entries.values().filter(|entry| entry.record.kind == Kind::Stream && entry.readers == 0 && entry.relocation.is_none()).collect();
            evictable.sort_by_key(|entry| entry.record.last_used_at);
            for entry in evictable {
                let excess = over.entry(root_of(&entry.record.download_dir)).or_insert(0);
                if *excess == 0 {
                    continue;
                }
                *excess = excess.saturating_sub(entry.progress().downloaded_bytes);
                actions.push(Action::Evict(entry.record.info_hash.clone()));
            }
        }
        actions
    }

    pub async fn reconcile(&self) {
        for action in self.plan() {
            let outcome = match action {
                Action::Pause(handle) => self.session.pause(&handle).await,
                Action::Resume(handle) => self.session.unpause(&handle).await,
                Action::SelectFiles(handle, files) => self.session.update_only_files(&handle, &files).await,
                Action::Evict(hash) => self.remove(&hash, true).await.map_err(|error| anyhow::anyhow!(error.message)),
            };
            if let Err(error) = outcome {
                tracing::warn!(error = format!("{error:#}"), "transfer scheduling step failed");
            }
        }
        self.emit_changes();
    }
}
