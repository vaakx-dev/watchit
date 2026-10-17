use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;

use serde::Deserialize;
use ts_rs::TS;
use watchit_core::{AppResult, Viewer};

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Hash, TS)]
#[ts(export_to = "playback/")]
pub struct SourceRef {
    pub info_hash: String,
    pub file_index: u32,
}

#[derive(Clone, Debug)]
pub enum SourceInput {
    Url(String),
    File(PathBuf),
}

impl SourceInput {
    pub fn ffmpeg_input(&self) -> String {
        match self {
            Self::Url(url) => url.clone(),
            Self::File(path) => path.to_string_lossy().into_owned(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct SourceFile {
    pub index: u32,
    pub path: String,
}

pub type FilesFuture<'a> = Pin<Box<dyn Future<Output = AppResult<Vec<SourceFile>>> + Send + 'a>>;

pub type SourceFuture<'a> = Pin<Box<dyn Future<Output = AppResult<SourceInput>> + Send + 'a>>;

pub trait SourceResolver: Send + Sync + 'static {
    fn resolve<'a>(&'a self, viewer: &'a Viewer, source: &'a SourceRef) -> SourceFuture<'a>;
    fn files<'a>(&'a self, info_hash: &'a str) -> FilesFuture<'a>;
}
