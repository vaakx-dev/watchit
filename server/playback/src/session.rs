use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::api::{AudioTrack, Mode, PlaybackSession, Protocol, SubtitleTrack, VideoInfo};
use crate::external::ExternalSubtitle;
use crate::hls::Job;
use crate::probe::{Media, SubtitleKind};
use crate::source::{SourceInput, SourceRef};
use crate::urls::{session_prefix, tokenized};

pub struct Session {
    pub id: String,
    pub owner: i64,
    pub source: SourceRef,
    pub input: SourceInput,
    pub token: String,
    pub external: Vec<ExternalSubtitle>,
    pub response: PlaybackSession,
    pub job: Option<Job>,
    last_access: Mutex<Instant>,
}

pub struct SessionParts {
    pub id: String,
    pub owner: i64,
    pub source: SourceRef,
    pub input: SourceInput,
    pub media: Arc<Media>,
    pub mode: Mode,
    pub job: Option<Job>,
    pub token: String,
    pub direct_url: String,
    pub converts_subtitles: bool,
    pub external: Vec<ExternalSubtitle>,
}

impl Session {
    pub fn new(parts: SessionParts) -> Self {
        let response = describe(&parts);
        let SessionParts {
            id,
            owner,
            source,
            input,
            job,
            token,
            external,
            ..
        } = parts;
        Self {
            id,
            owner,
            source,
            input,
            token,
            external,
            response,
            job,
            last_access: Mutex::new(Instant::now()),
        }
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
    let SessionParts {
        id,
        media,
        mode,
        token,
        direct_url,
        converts_subtitles,
        external,
        ..
    } = parts;
    let prefix = session_prefix(id);
    let (protocol, url) = match mode {
        Mode::Direct => (Protocol::File, direct_url.clone()),
        _ => (Protocol::Hls, tokenized(&format!("{prefix}hls/main.m3u8"), token)),
    };
    PlaybackSession {
        id: id.clone(),
        mode: *mode,
        protocol,
        url,
        duration_seconds: media.duration,
        video: media.video.as_ref().map(|video| VideoInfo {
            codec: video.codec.clone(),
            width: video.width,
            height: video.height,
            hdr: video.hdr_label().map(str::to_owned),
        }),
        audio_tracks: media
            .audio
            .iter()
            .map(|audio| AudioTrack {
                index: audio.index,
                language: audio.language.clone(),
                title: audio.title.clone(),
                codec: audio.codec.clone(),
                channels: audio.channels,
                default: audio.default,
            })
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
                url: (*converts_subtitles && subtitle.kind == SubtitleKind::Text)
                    .then(|| tokenized(&format!("{prefix}subtitles/{}.vtt", subtitle.index), token)),
                external: false,
            })
            .chain(external.iter().map(|subtitle| SubtitleTrack {
                index: subtitle.index,
                language: subtitle.language.clone(),
                title: Some(subtitle.title.clone()),
                codec: subtitle.codec.to_owned(),
                default: false,
                url: Some(if *converts_subtitles {
                    tokenized(&format!("{prefix}subtitles/{}.vtt", subtitle.index), token)
                } else {
                    subtitle.input.ffmpeg_input()
                }),
                external: true,
            }))
            .collect(),
    }
}
