use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::api::{AudioTrack, Mode, PlaybackSession, Protocol, SubtitleTrack, VideoInfo};
use crate::hls::Job;
use crate::probe::{Media, SubtitleKind};
use crate::source::{SourceInput, SourceRef};
use crate::urls::{media_url, raw_path, session_path};

pub struct Session {
    pub id: String,
    pub owner: i64,
    pub source: SourceRef,
    pub input: SourceInput,
    pub response: PlaybackSession,
    pub job: Option<Job>,
    last_access: Mutex<Instant>,
}

pub struct SessionParts {
    pub id: String,
    pub owner: i64,
    pub source: SourceRef,
    pub input: SourceInput,
    pub media: std::sync::Arc<Media>,
    pub mode: Mode,
    pub job: Option<Job>,
    pub token: String,
    pub converts_subtitles: bool,
}

impl Session {
    pub fn new(parts: SessionParts) -> Self {
        let response = describe(&parts);
        let SessionParts { id, owner, source, input, job, .. } = parts;
        Self { id, owner, source, input, response, job, last_access: Mutex::new(Instant::now()) }
    }

    pub fn touch(&self) {
        *self.last_access.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = Instant::now();
    }

    pub fn idle_for(&self) -> Duration {
        let since_request = self.last_access.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).elapsed();
        self.job.as_ref().map_or(since_request, |job| since_request.min(job.idle_for()))
    }
}

fn describe(parts: &SessionParts) -> PlaybackSession {
    let SessionParts { id, source, media, mode, token, converts_subtitles, .. } = parts;
    let (protocol, url) = match mode {
        Mode::Direct => (Protocol::File, media_url(&raw_path(source), token)),
        _ => (Protocol::Hls, media_url(&session_path(id, "hls/main.m3u8"), token)),
    };
    PlaybackSession {
        id: id.clone(),
        mode: *mode,
        protocol,
        url,
        duration_seconds: media.duration,
        video: media.video.as_ref().map(|video| VideoInfo { codec: video.codec.clone(), width: video.width, height: video.height, hdr: video.hdr_label() }),
        audio_tracks: media
            .audio
            .iter()
            .map(|audio| AudioTrack { index: audio.index, language: audio.language.clone(), title: audio.title.clone(), codec: audio.codec.clone(), channels: audio.channels, default: audio.default })
            .collect(),
        subtitle_tracks: media
            .subtitles
            .iter()
            .map(|subtitle| SubtitleTrack {
                index: subtitle.index,
                language: subtitle.language.clone(),
                title: subtitle.title.clone(),
                codec: subtitle.codec.clone(),
                default: subtitle.default,
                url: (*converts_subtitles && subtitle.kind == SubtitleKind::Text).then(|| media_url(&session_path(id, &format!("subtitles/{}.vtt", subtitle.index)), token)),
            })
            .collect(),
    }
}
