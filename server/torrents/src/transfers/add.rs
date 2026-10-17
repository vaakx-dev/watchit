use std::path::PathBuf;
use std::sync::Arc;

use watchit_core::{AppError, AppResult};

use super::entry::Entry;
use super::model::{Kind, Transfer};
use super::pick;
use super::record::{Pick, Record};
use super::{Transfers, now};
use crate::engine::{self, AddRequest, Metadata};

pub fn valid_info_hash(value: &str) -> AppResult<String> {
    let hash = value.to_ascii_lowercase();
    if hash.len() == 40 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(hash)
    } else {
        Err(AppError::bad_request("Invalid info hash."))
    }
}

fn folder_name(name: &str) -> String {
    let cleaned: String = name.chars().map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c }).collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']);
    if trimmed.is_empty() { "torrent".to_owned() } else { trimmed.to_owned() }
}

fn output_folder(download_dir: PathBuf, metadata: &Metadata) -> PathBuf {
    if metadata.files.len() > 1 { download_dir.join(folder_name(&metadata.name)) } else { download_dir }
}

impl Transfers {
    pub async fn add(self: &Arc<Self>, info_hash: &str, pick: Pick, kind: Kind) -> AppResult<Transfer> {
        let info_hash = valid_info_hash(info_hash)?;
        let trackers = self.search.trackers(&info_hash);
        let existing = {
            let mut entries = self.entries();
            match entries.get_mut(&info_hash) {
                Some(entry) => {
                    entry.record.kind = entry.record.kind.max(kind);
                    entry.record.last_used_at = now();
                    if entry.record.trackers.is_empty() {
                        entry.record.trackers = trackers;
                    }
                    match &entry.handle {
                        Some(handle) => {
                            let available = engine::files_of(handle).map_err(AppError::internal)?;
                            entry.files = pick::resolve(&[pick], &available, &entry.record.name, &entry.files);
                        }
                        None => entry.record.picks.push(pick),
                    }
                    true
                }
                None => {
                    let record = Record {
                        info_hash: info_hash.clone(),
                        name: info_hash.clone(),
                        title_id: pick.title_id.clone(),
                        kind,
                        paused: false,
                        added_at: now(),
                        last_used_at: now(),
                        uploaded_bytes: 0,
                        seeded_seconds: 0,
                        trackers,
                        error: None,
                        picks: vec![pick],
                    };
                    entries.insert(info_hash.clone(), Entry::new(record, Vec::new()));
                    false
                }
            }
        };
        self.persist(&info_hash).await?;
        if !existing {
            self.fetch_metadata(&info_hash);
        }
        self.wake();
        self.transfer(&info_hash).ok_or_else(|| AppError::not_found("Transfer was removed."))
    }

    pub fn fetch_metadata(self: &Arc<Self>, info_hash: &str) {
        if let Some(entry) = self.entries().get_mut(info_hash) {
            entry.record.error = None;
        }
        let transfers = Arc::clone(self);
        let hash = info_hash.to_owned();
        let task = tokio::spawn(async move {
            let trackers = transfers.entries().get(&hash).map(|entry| entry.record.trackers.clone()).unwrap_or_default();
            let outcome = match engine::resolve(&transfers.session, &hash, &trackers).await {
                Ok(metadata) => transfers.attach(&hash, metadata).await,
                Err(error) => Err(AppError::internal(format!("{error:#}"))),
            };
            if let Err(error) = outcome {
                transfers.fail(&hash, error.message).await;
            }
        });
        if let Some(entry) = self.entries().get_mut(info_hash) {
            entry.resolving = Some(task.abort_handle());
        }
    }

    async fn fail(&self, info_hash: &str, message: String) {
        if let Some(entry) = self.entries().get_mut(info_hash) {
            entry.record.error = Some(message);
            entry.resolving = None;
        }
        let _ = self.persist(info_hash).await;
        self.resolved.notify_waiters();
        self.wake();
    }

    async fn attach(self: &Arc<Self>, info_hash: &str, metadata: Metadata) -> AppResult<()> {
        let request = {
            let mut entries = self.entries();
            let Some(entry) = entries.get_mut(info_hash) else { return Ok(()) };
            entry.record.name = metadata.name.clone();
            entry.files = pick::resolve(&entry.record.picks, &metadata.files, &metadata.name, &entry.files);
            entry.record.picks.clear();
            if entry.files.is_empty() {
                return Err(AppError::not_found("No files in this torrent match the request."));
            }
            AddRequest {
                output_folder: output_folder(self.settings().download_dir, &metadata),
                only_files: entry.files.iter().map(|file| file.index).collect(),
                paused: entry.record.paused || entry.record.kind == Kind::Download,
                trackers: entry.record.trackers.clone(),
            }
        };
        let handle = engine::add_resolved(&self.session, &metadata, request).await.map_err(|error| AppError::internal(format!("{error:#}")))?;
        let attached = match self.entries().get_mut(info_hash) {
            Some(entry) => {
                entry.handle = Some(handle.clone());
                entry.resolving = None;
                entry.record.error = None;
                true
            }
            None => false,
        };
        if !attached {
            let _ = self.session.delete(handle.id().into(), true).await;
            return Ok(());
        }
        self.persist(info_hash).await?;
        self.resolved.notify_waiters();
        self.wake();
        Ok(())
    }
}
