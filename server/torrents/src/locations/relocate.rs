use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::http::StatusCode;
use watchit_core::{AppError, AppResult};

use super::mover::{Relocation, move_files, remove_empty_parents};
use super::volume::{free_bytes, same_volume};
use crate::engine::{self, AddRequest, Handle, Metadata};
use crate::transfers::add::valid_info_hash;
use crate::transfers::model::{Kind, Transfer};
use crate::transfers::snapshot::snapshot;
use crate::transfers::{Entry, Transfers, pick};

const SETTLE: Duration = Duration::from_millis(400);
const RESTORE_ATTEMPTS: u32 = 50;
const RESTORE_WAIT: Duration = Duration::from_millis(100);

pub struct Moving {
    pub target: PathBuf,
    pub before: Transfer,
}

struct Job {
    info_hash: String,
    handle: Handle,
    from_dir: PathBuf,
    to_dir: PathBuf,
}

fn keep_file(bitfield: &Path) -> PathBuf {
    bitfield.with_extension("bitv.keep")
}

fn relative_paths(handle: &Handle) -> anyhow::Result<Vec<PathBuf>> {
    handle.with_metadata(|metadata| {
        metadata.file_infos.iter().filter(|info| !info.attrs.padding).map(|info| info.relative_filename.clone()).collect()
    })
}

fn output_under(handle: &Handle, from_dir: &Path, to_dir: &Path) -> PathBuf {
    let output = handle.output_folder();
    if output == from_dir { to_dir.to_path_buf() } else { to_dir.join(output.file_name().unwrap_or_default()) }
}

pub fn busy() -> AppError {
    AppError::new(StatusCode::CONFLICT, "This download is being moved. Try again when it has finished.")
}

impl Transfers {
    pub async fn relocate(self: &Arc<Self>, id: &str, target: PathBuf) -> AppResult<Transfer> {
        let info_hash = valid_info_hash(id)?;
        let job = {
            let mut entries = self.entries();
            let entry = entries.get_mut(&info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))?;
            if entry.relocation.is_some() {
                return Err(busy());
            }
            if entry.record.download_dir == target {
                return Ok(snapshot(entry));
            }
            match entry.handle.clone() {
                None => {
                    entry.record.download_dir = target;
                    None
                }
                Some(handle) => {
                    self.begin_move(entry, &target);
                    Some(Job { info_hash: info_hash.clone(), handle, from_dir: entry.record.download_dir.clone(), to_dir: target })
                }
            }
        };
        match job {
            None => self.persist(&info_hash).await?,
            Some(job) => {
                self.emit_changes();
                let transfers = Arc::clone(self);
                tokio::spawn(async move { transfers.run_move(job).await });
            }
        }
        self.transfer(&info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))
    }

    fn begin_move(&self, entry: &mut Entry, target: &Path) {
        let before = snapshot(entry);
        entry.handle = None;
        entry.move_error = None;
        entry.relocation = Some(Moving { target: target.to_path_buf(), before });
    }

    pub async fn move_to_default(self: &Arc<Self>, info_hash: &str) {
        let target = {
            let entries = self.entries();
            let Some(entry) = entries.get(info_hash) else { return };
            let series = super::defaults::is_series_title(&entry.record.title_id);
            self.settings().folder_for(Kind::Download, series)
        };
        if let Err(error) = self.relocate(info_hash, target).await {
            tracing::warn!(%error, "could not move a kept download to its folder");
        }
    }

    async fn run_move(self: Arc<Self>, job: Job) {
        let outcome = self.move_files_of(&job).await;
        let moved = outcome.is_ok();
        let location = if moved { job.to_dir.clone() } else { job.from_dir.clone() };
        let reattached = self.reattach(&job, &location).await;
        {
            let mut entries = self.entries();
            if let Some(entry) = entries.get_mut(&job.info_hash) {
                entry.relocation = None;
                entry.move_error = outcome.err();
                match reattached {
                    Ok(handle) => {
                        entry.record.download_dir = location;
                        entry.handle = Some(handle);
                        entry.record.error = None;
                        if !entry.record.picks.is_empty() {
                            let available = engine::files_of(entry.handle.as_ref().expect("handle just set")).unwrap_or_default();
                            entry.files = pick::resolve(&entry.record.picks, &available, &entry.record.name, &entry.files);
                            entry.record.picks.clear();
                        }
                    }
                    Err(error) => {
                        entry.record.download_dir = location;
                        entry.record.error = Some(format!("{error:#}"));
                    }
                }
            }
        }
        if let Err(error) = self.persist(&job.info_hash).await {
            tracing::warn!(%error, "could not save a moved transfer");
        }
        self.resolved.notify_waiters();
        self.wake();
    }

    async fn move_files_of(&self, job: &Job) -> Result<(), String> {
        let relative = relative_paths(&job.handle).map_err(|error| format!("{error:#}"))?;
        let from = job.handle.output_folder().to_path_buf();
        let to = output_under(&job.handle, &job.from_dir, &job.to_dir);
        self.keep_progress(&job.handle).await;
        self.session.delete(job.handle.id().into(), false).await.map_err(|error| format!("{error:#}"))?;
        let files: Vec<Relocation> =
            relative.iter().map(|path| Relocation { from: from.join(path), to: to.join(path) }).collect();
        let stop = (from != job.from_dir).then(|| from.clone());
        let needed: u64 = files.iter().filter_map(|file| std::fs::metadata(&file.from).ok()).map(|meta| meta.len()).sum();
        if !same_volume(&job.from_dir, &job.to_dir) && needed > free_bytes(&job.to_dir) {
            return Err("There isn't enough free space in that folder.".to_owned());
        }
        let moved = tokio::task::spawn_blocking(move || {
            move_files(&files)?;
            if let Some(stop) = stop {
                for file in &files {
                    remove_empty_parents(&file.from, &stop);
                }
            }
            Ok::<_, std::io::Error>(())
        })
        .await
        .map_err(|error| error.to_string())?;
        moved.map_err(|error| format!("The files couldn't be moved: {error}."))
    }

    async fn keep_progress(&self, handle: &Handle) {
        let _ = self.session.pause(handle).await;
        tokio::time::sleep(SETTLE).await;
        let bitfield = self.bitfield_of(handle);
        let _ = tokio::fs::copy(&bitfield, keep_file(&bitfield)).await;
    }

    fn bitfield_of(&self, handle: &Handle) -> PathBuf {
        engine::bitfield_file(&self.session_folder, &handle.info_hash().as_string())
    }

    async fn restore_progress(&self, info_hash: &str) {
        let bitfield = engine::bitfield_file(&self.session_folder, info_hash);
        let kept = keep_file(&bitfield);
        for _ in 0..RESTORE_ATTEMPTS {
            if tokio::fs::copy(&kept, &bitfield).await.is_ok() {
                break;
            }
            tokio::time::sleep(RESTORE_WAIT).await;
        }
        let _ = tokio::fs::remove_file(&kept).await;
    }

    async fn reattach(&self, job: &Job, location: &Path) -> anyhow::Result<Handle> {
        self.restore_progress(&job.info_hash).await;
        let metadata = Metadata::of(&job.handle)?;
        let request = {
            let entries = self.entries();
            let entry = entries.get(&job.info_hash).ok_or_else(|| anyhow::anyhow!("The transfer was removed."))?;
            AddRequest {
                output_folder: output_under(&job.handle, &job.from_dir, location),
                only_files: entry.files.iter().map(|file| file.index).collect(),
                paused: entry.record.paused || entry.record.kind == Kind::Download,
                trackers: entry.record.trackers.clone(),
            }
        };
        engine::add_resolved(&self.session, &metadata, request).await
    }
}
