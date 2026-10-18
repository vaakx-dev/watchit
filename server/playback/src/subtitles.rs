use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tokio::sync::OnceCell;
use watchit_core::{AppError, AppResult};

use crate::ffmpeg::Tools;
use crate::source::{SourceInput, SourceRef};

pub struct Subtitles {
    tools: Tools,
    directory: PathBuf,
    extractions: Mutex<HashMap<PathBuf, Arc<OnceCell<PathBuf>>>>,
}

impl Subtitles {
    pub fn new(tools: Tools, directory: PathBuf) -> Self {
        Self {
            tools,
            directory,
            extractions: Mutex::new(HashMap::new()),
        }
    }

    pub async fn webvtt(&self, source: &SourceRef, input: &SourceInput, stream: u32) -> AppResult<PathBuf> {
        let path = self.directory.join(format!("{}-{}-{stream}.vtt", source.info_hash, source.file_index));
        let extraction = self
            .extractions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .entry(path.clone())
            .or_default()
            .clone();
        extraction.get_or_try_init(|| self.extract(input, stream, path)).await.cloned()
    }

    async fn extract(&self, input: &SourceInput, stream: u32, path: PathBuf) -> AppResult<PathBuf> {
        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            return Ok(path);
        }
        tokio::fs::create_dir_all(&self.directory).await.map_err(AppError::internal)?;
        let partial = path.with_extension("vtt.part");
        let output = self
            .tools
            .ffmpeg()
            .args([
                "-hide_banner",
                "-v",
                "error",
                "-i",
                &input.ffmpeg_input(),
                "-map",
                &format!("0:{stream}"),
                "-c:s",
                "webvtt",
                "-f",
                "webvtt",
                "-y",
            ])
            .arg(&partial)
            .output()
            .await
            .map_err(AppError::internal)?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::warn!(stream, stderr = %stderr.trim(), "subtitle conversion failed");
            return Err(AppError::internal(format!("Subtitle {stream} could not be converted.")));
        }
        tokio::fs::rename(&partial, &path).await.map_err(AppError::internal)?;
        Ok(path)
    }
}
