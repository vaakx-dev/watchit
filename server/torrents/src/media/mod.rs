mod mime;
mod range;
pub mod raw;

use std::path::PathBuf;

use watchit_core::StreamTokens;

#[derive(Clone, Debug)]
pub enum MediaSource {
    File(PathBuf),
    Url(String),
}

pub fn raw_path(info_hash: &str, file_index: usize) -> String {
    format!("/api/torrents/{info_hash}/{file_index}/raw")
}

pub fn raw_url(tokens: &StreamTokens, profile: i64, info_hash: &str, file_index: usize) -> String {
    tokens.url(profile, &raw_path(info_hash, file_index))
}
