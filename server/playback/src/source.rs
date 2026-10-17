use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;

use serde::Deserialize;
use watchit_core::AppResult;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Hash)]
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

pub type SourceFuture<'a> = Pin<Box<dyn Future<Output = AppResult<SourceInput>> + Send + 'a>>;

pub trait SourceResolver: Send + Sync + 'static {
    fn resolve<'a>(&'a self, source: &'a SourceRef) -> SourceFuture<'a>;
}
