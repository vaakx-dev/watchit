mod api;
mod decide;
mod ffmpeg;
mod hls;
mod keyframes;
mod probe;
mod routes;
mod service;
mod session;
mod source;
mod subtitles;
mod urls;

use ts_rs::{Config, ExportError, TS};

pub use api::{AudioTrack, ClientProfile, CreateSession, Mode, PlaybackSession, Player, Protocol, SubtitleTrack, VideoInfo};
pub use routes::router;
pub use ffmpeg::SOURCE_FFMPEG_DIR;
pub use service::Playback;
pub use source::{SourceFuture, SourceInput, SourceRef, SourceResolver};

pub fn export_types(config: &Config) -> Result<(), ExportError> {
    CreateSession::export_all(config)?;
    PlaybackSession::export_all(config)
}
