use std::sync::Arc;

use librqbit::TorrentStatsState;
use watchit_core::{AppError, AppResult};

use super::Transfers;
use crate::locations::busy;
use super::add::valid_info_hash;
use super::model::{Kind, Transfer};

pub struct Change {
    pub paused: Option<bool>,
    pub kind: Option<Kind>,
    pub notify_when_ready: Option<bool>,
    pub queue_position: Option<u32>,
}

impl Transfers {
    pub async fn change(self: &Arc<Self>, id: &str, change: Change) -> AppResult<Transfer> {
        let info_hash = valid_info_hash(id)?;
        let (refetch, restart) = {
            let mut entries = self.entries();
            let entry = entries.get_mut(&info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))?;
            if let Some(kind) = change.kind {
                entry.record.kind = entry.record.kind.max(kind);
            }
            if let Some(notify) = change.notify_when_ready {
                entry.record.notify_when_ready = notify;
            }
            let resume = change.paused == Some(false);
            if let Some(paused) = change.paused {
                entry.record.paused = paused;
            }
            let refetch = resume && entry.handle.is_none() && entry.record.error.is_some();
            let restart = entry
                .handle
                .clone()
                .filter(|_| resume && matches!(entry.progress().engine_state(), Some(TorrentStatsState::Error)));
            (refetch, restart)
        };
        self.persist(&info_hash).await?;
        if let Some(position) = change.queue_position {
            self.move_in_queue(&info_hash, position).await?;
        }
        if refetch {
            self.fetch_metadata(&info_hash);
        }
        if let Some(handle) = restart {
            self.session.unpause(&handle).await.map_err(|error| AppError::internal(format!("{error:#}")))?;
        }
        self.wake();
        self.transfer(&info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))
    }

    pub async fn remove(&self, id: &str, delete_files: bool) -> AppResult<()> {
        let info_hash = valid_info_hash(id)?;
        let entry = {
            let mut entries = self.entries();
            if entries.get(&info_hash).is_some_and(|entry| entry.relocation.is_some()) {
                return Err(busy());
            }
            entries.remove(&info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))?
        };
        if let Some(task) = &entry.resolving {
            task.abort();
        }
        let hash = info_hash.clone();
        self.db.run(move |conn| super::store::delete(conn, &hash)).await?;
        if let Some(handle) = &entry.handle {
            self.session.delete(handle.id().into(), delete_files).await.map_err(|error| AppError::internal(format!("{error:#}")))?;
        }
        if delete_files {
            Transfers::unlink_library(entry.library, self.settings().download_dir()).await;
        }
        self.emit_removed(&info_hash);
        self.wake();
        Ok(())
    }

    pub async fn resume_for_playback(self: &Arc<Self>, info_hash: &str) -> AppResult<()> {
        let paused = self.entries().get(info_hash).is_some_and(|entry| entry.record.paused);
        if paused {
            self.change(info_hash, Change { paused: Some(false), kind: None, queue_position: None, notify_when_ready: None }).await?;
        }
        Ok(())
    }
}
