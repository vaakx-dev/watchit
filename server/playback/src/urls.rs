use watchit_core::Viewer;

use crate::source::SourceRef;

pub trait StreamTokens: Send + Sync + 'static {
    fn mint(&self, viewer: &Viewer) -> String;
}

pub fn media_url(path: &str, token: &str) -> String {
    format!("{path}?token={token}")
}

pub fn raw_path(source: &SourceRef) -> String {
    format!("/api/torrents/{}/{}/raw", source.info_hash, source.file_index)
}

pub fn session_path(session: &str, rest: &str) -> String {
    format!("/api/playback/sessions/{session}/{rest}")
}
