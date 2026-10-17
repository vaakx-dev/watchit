use crate::source::SourceRef;

pub fn tokenized(path: &str, token: &str) -> String {
    format!("{path}?token={token}")
}

pub fn raw_path(source: &SourceRef) -> String {
    format!("/api/torrents/{}/{}/raw", source.info_hash, source.file_index)
}

pub fn session_prefix(session: &str) -> String {
    format!("/api/playback/sessions/{session}/")
}
