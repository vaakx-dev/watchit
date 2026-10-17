use serde::{Deserialize, Serialize};

use crate::source::SourceRef;

#[derive(Deserialize)]
pub struct CreateSession {
    pub title_id: String,
    pub source: SourceRef,
    pub client: ClientProfile,
    pub start_seconds: Option<f64>,
    pub audio_track: Option<u32>,
    #[serde(default)]
    pub subtitle_track: Option<u32>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Player {
    Mpv,
    Browser,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ClientProfile {
    pub player: Player,
    pub containers: Vec<String>,
    pub video_codecs: Vec<String>,
    pub audio_codecs: Vec<String>,
    pub hdr: bool,
    pub max_height: u32,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Direct,
    Remux,
    Audio,
    Transcode,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    File,
    Hls,
}

#[derive(Clone, Debug, Serialize)]
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

#[derive(Clone, Debug, Serialize)]
pub struct VideoInfo {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub hdr: Option<&'static str>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AudioTrack {
    pub index: u32,
    pub language: Option<String>,
    pub title: Option<String>,
    pub codec: String,
    pub channels: u32,
    pub default: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct SubtitleTrack {
    pub index: u32,
    pub language: Option<String>,
    pub title: Option<String>,
    pub codec: String,
    pub default: bool,
    pub url: Option<String>,
}
