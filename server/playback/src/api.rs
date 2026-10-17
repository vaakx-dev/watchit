use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::source::SourceRef;

#[derive(Deserialize, TS)]
#[ts(export_to = "playback/")]
pub struct CreateSession {
    pub title_id: String,
    pub source: SourceRef,
    pub client: ClientProfile,
    #[serde(default)]
    #[ts(optional)]
    pub start_seconds: Option<f64>,
    #[serde(default)]
    #[ts(optional)]
    pub audio_track: Option<u32>,
    #[serde(default)]
    #[ts(optional = nullable)]
    pub subtitle_track: Option<u32>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "playback/")]
pub enum Player {
    Mpv,
    Browser,
}

#[derive(Clone, Debug, Deserialize, TS)]
#[ts(export_to = "playback/")]
pub struct ClientProfile {
    pub player: Player,
    pub containers: Vec<String>,
    pub video_codecs: Vec<String>,
    pub audio_codecs: Vec<String>,
    pub hdr: bool,
    pub max_height: u32,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "playback/")]
pub enum Mode {
    Direct,
    Remux,
    Audio,
    Transcode,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "playback/")]
pub enum Protocol {
    File,
    Hls,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "playback/")]
pub struct PlaybackSession {
    pub id: String,
    pub mode: Mode,
    pub protocol: Protocol,
    pub url: String,
    pub duration_seconds: Option<f64>,
    pub video: Option<VideoInfo>,
    pub audio_tracks: Vec<AudioTrack>,
    pub subtitle_tracks: Vec<SubtitleTrack>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "playback/")]
pub struct VideoInfo {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub hdr: Option<String>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "playback/")]
pub struct AudioTrack {
    pub index: u32,
    pub language: Option<String>,
    pub title: Option<String>,
    pub codec: String,
    pub channels: u32,
    pub default: bool,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "playback/")]
pub struct SubtitleTrack {
    pub index: u32,
    pub language: Option<String>,
    pub title: Option<String>,
    pub codec: String,
    pub default: bool,
    pub url: Option<String>,
    pub external: bool,
}
