use std::collections::{BTreeSet, HashMap, HashSet};
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use librqbit::TorrentStatsState;
use librqbit::limits::LimitsConfig;

use super::Transfers;
use super::entry::Entry;
use super::model::Kind;
use crate::bandwidth;
use crate::engine::{self, Handle};
use crate::locations::root_of;
use crate::queue;

const TICK: Duration = Duration::from_secs(1);
const PERSIST_EVERY: u32 = 15;

enum Action {
    Pause(Handle),
    Resume(Handle),
    SelectFiles(Handle, HashSet<usize>),
    Limit(Handle, LimitsConfig),
    Evict(String),
}

impl Transfers {
    pub async fn run_scheduler(self: &Arc<Self>, stopping: impl Future<Output = ()>) {
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
            self.refresh_engine().await;
            self.account(elapsed);
            self.sample_readiness(elapsed).await;
            self.reconcile().await;
            self.import_finished();
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
            let Some(uploaded) = progress.stats.as_ref().map(|stats| stats.uploaded_bytes) else {
                continue;
            };
            let delta = if uploaded >= entry.live_uploaded {
                uploaded - entry.live_uploaded
            } else {
                uploaded
            };
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
        let used = queue::used_by_drive(&entries);
        queue::assign_slots(&mut entries, &settings, used.clone());
        let limits = bandwidth::steer_background(&mut entries, self.bandwidth.background());
        let mut actions: Vec<Action> = limits.into_iter().map(|(handle, limits)| Action::Limit(handle, limits)).collect();

        for entry in entries.values() {
            let (Some(handle), Some(view)) = (entry.handle.clone(), entry.engine.as_ref()) else {
                continue;
            };
            let progress = entry.progress();
            let engine = progress.engine_state();
            let wanted: BTreeSet<usize> = queue::wanted_files(entry, &progress);
            if !matches!(engine, Some(TorrentStatsState::Initializing { .. })) && view.only_files.as_ref() != Some(&wanted) {
                actions.push(Action::SelectFiles(handle.clone(), wanted.into_iter().collect()));
            }
            match (engine, entry.slot.runs()) {
                (Some(TorrentStatsState::Live), false) => actions.push(Action::Pause(handle)),
                (Some(TorrentStatsState::Paused), true) => actions.push(Action::Resume(handle)),
                _ => {}
            }
        }

        if let Some(budget) = settings.disk_budget_bytes {
            let mut over: HashMap<PathBuf, u64> = used.into_iter().map(|(drive, bytes)| (drive, bytes.saturating_sub(budget))).collect();
            let mut evictable: Vec<&Entry> = entries
                .values()
                .filter(|entry| entry.record.kind == Kind::Stream && entry.readers == 0 && entry.relocation.is_none())
                .collect();
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
        self.steer_bandwidth().await;
        let actions = self.plan();
        let acted = !actions.is_empty();
        for action in actions {
            let outcome = match action {
                Action::Pause(handle) if engine::is_live(&handle) => self.session.pause(&handle).await,
                Action::Resume(handle) if engine::is_paused(&handle) => self.session.unpause(&handle).await,
                Action::Pause(_) | Action::Resume(_) => Ok(()),
                Action::SelectFiles(handle, files) => self.session.update_only_files(&handle, &files).await,
                Action::Limit(handle, limits) => {
                    handle.set_ratelimits(limits);
                    Ok(())
                }
                Action::Evict(hash) => self.remove(&hash, true).await.map_err(|error| anyhow::anyhow!(error.message)),
            };
            if let Err(error) = outcome {
                tracing::warn!(error = format!("{error:#}"), "transfer scheduling step failed");
            }
        }
        if acted {
            self.refresh_engine().await;
        }
        self.emit_changes();
    }
}
