use std::net::SocketAddr;

use watchit_core::Viewer;
use watchit_playback::{FilesFuture, SourceFile, SourceFuture, SourceInput, SourceRef, SourceResolver};
use watchit_torrents::{MediaSource, Torrents};

pub struct TorrentSources {
    torrents: Torrents,
    origin: String,
}

impl TorrentSources {
    pub fn new(torrents: Torrents, addr: SocketAddr) -> Self {
        Self {
            torrents,
            origin: format!("http://127.0.0.1:{}", addr.port()),
        }
    }
}

impl SourceResolver for TorrentSources {
    fn resolve<'a>(&'a self, viewer: &'a Viewer, source: &'a SourceRef) -> SourceFuture<'a> {
        Box::pin(async move {
            let index = source.file_index as usize;
            Ok(match self.torrents.source(viewer, &source.info_hash, index, &self.origin).await? {
                MediaSource::File(path) => SourceInput::File(path),
                MediaSource::Url(url) => SourceInput::Url(url),
            })
        })
    }

    fn files<'a>(&'a self, info_hash: &'a str) -> FilesFuture<'a> {
        Box::pin(async move {
            let files = self.torrents.files(info_hash).await?;
            Ok(files
                .into_iter()
                .map(|file| SourceFile {
                    index: file.index as u32,
                    path: file.path,
                })
                .collect())
        })
    }
}
