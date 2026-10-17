use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::http::StatusCode;
use tokio::io::{AsyncRead, AsyncSeek};
use watchit_core::{AppError, AppResult};

use super::record::FileRecord;
use super::{Transfers, now};
use crate::engine::{self, Handle};

const METADATA_WAIT: Duration = Duration::from_secs(90);

pub trait MediaReader: AsyncRead + AsyncSeek + Send + Unpin {}

impl<T: AsyncRead + AsyncSeek + Send + Unpin> MediaReader for T {}

pub struct OpenedFile {
    pub name: String,
    pub len: u64,
    pub reader: Box<dyn MediaReader>,
    pub guard: ReaderGuard,
}

pub struct ReaderGuard {
    transfers: Arc<Transfers>,
    info_hash: String,
}

impl Drop for ReaderGuard {
    fn drop(&mut self) {
        if let Some(entry) = self.transfers.entries().get_mut(&self.info_hash) {
            entry.readers = entry.readers.saturating_sub(1);
            entry.record.last_used_at = now();
        }
        self.transfers.wake();
    }
}

fn engine_error(error: anyhow::Error) -> AppError {
    AppError::new(StatusCode::BAD_GATEWAY, format!("{error:#}"))
}

impl Transfers {
    pub async fn ready_handle(&self, info_hash: &str) -> AppResult<Handle> {
        let waiting = tokio::time::timeout(METADATA_WAIT, async {
            loop {
                let resolved = self.resolved.notified();
                tokio::pin!(resolved);
                resolved.as_mut().enable();
                {
                    let entries = self.entries();
                    let entry = entries.get(info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))?;
                    if let Some(handle) = &entry.handle {
                        return Ok(handle.clone());
                    }
                    if let Some(error) = &entry.record.error {
                        return Err(AppError::new(StatusCode::BAD_GATEWAY, error.clone()));
                    }
                }
                resolved.await;
            }
        });
        waiting.await.map_err(|_| AppError::new(StatusCode::GATEWAY_TIMEOUT, "Torrent metadata did not arrive in time.").retry_after(5))?
    }

    fn start_reading(self: &Arc<Self>, info_hash: &str, index: usize, handle: &Handle) -> AppResult<(String, u64, ReaderGuard)> {
        let available = engine::files_of(handle).map_err(engine_error)?;
        let file = available.into_iter().find(|file| file.index == index).ok_or_else(|| AppError::not_found("File not found in torrent."))?;
        let mut entries = self.entries();
        let entry = entries.get_mut(info_hash).ok_or_else(|| AppError::not_found("Transfer not found."))?;
        if !entry.files.iter().any(|known| known.index == index) {
            entry.files.push(FileRecord { index, name: file.path.clone(), size_bytes: file.size_bytes, title_id: None });
            entry.files.sort_by_key(|known| known.index);
        }
        entry.readers += 1;
        entry.record.last_used_at = now();
        drop(entries);
        self.wake();
        Ok((file.path, file.size_bytes, ReaderGuard { transfers: Arc::clone(self), info_hash: info_hash.to_owned() }))
    }

    pub fn disk_path(&self, handle: &Handle, index: usize) -> AppResult<PathBuf> {
        let relative = handle
            .with_metadata(|metadata| metadata.file_infos.get(index).map(|info| info.relative_filename.clone()))
            .map_err(engine_error)?
            .ok_or_else(|| AppError::not_found("File not found in torrent."))?;
        Ok(handle.output_folder().join(relative))
    }

    pub fn complete_file(&self, info_hash: &str, index: usize) -> bool {
        self.entries().get(info_hash).is_some_and(|entry| entry.file_complete(index))
    }

    pub async fn open_file(self: &Arc<Self>, info_hash: &str, index: usize) -> AppResult<OpenedFile> {
        let handle = self.ready_handle(info_hash).await?;
        let (name, len, guard) = self.start_reading(info_hash, index, &handle)?;
        if self.complete_file(info_hash, index) {
            let file = tokio::fs::File::open(self.disk_path(&handle, index)?).await.map_err(AppError::internal)?;
            return Ok(OpenedFile { name, len, reader: Box::new(file), guard });
        }
        handle.wait_until_initialized().await.map_err(engine_error)?;
        let stream = handle.clone().stream(index).await.map_err(engine_error)?;
        Ok(OpenedFile { name, len, reader: Box::new(stream), guard })
    }
}
