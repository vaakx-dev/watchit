use serde::Serialize;
use ts_rs::TS;

use crate::release::{Hdr, Resolution};

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct TorrentResult {
    pub info_hash: String,
    pub file_index: Option<usize>,
    pub name: String,
    pub filename: Option<String>,
    pub resolution: Option<Resolution>,
    pub hdr: Vec<Hdr>,
    pub video_codec: Option<String>,
    pub audio: Option<String>,
    pub size_bytes: Option<u64>,
    pub seeders: Option<u32>,
    pub site: Option<String>,
    pub languages: Vec<String>,
    pub season_pack: bool,
}

#[derive(Clone, Debug)]
pub struct Traits {
    pub dolby_vision_without_fallback: bool,
    pub remux: bool,
    pub disc_image: bool,
    pub cam: bool,
    pub three_d: bool,
}

#[derive(Clone, Debug)]
pub struct Candidate {
    pub result: TorrentResult,
    pub traits: Traits,
    pub trackers: Vec<String>,
}
