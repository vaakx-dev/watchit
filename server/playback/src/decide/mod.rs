mod browser;
mod reasons;
mod target;

use axum::http::StatusCode;
use watchit_core::{AppError, AppResult};

use crate::api::{ClientProfile, CreateSession, Mode, Player};
use crate::ffmpeg::Encoders;
use crate::probe::{AudioStream, Media, SubtitleKind};
pub use reasons::Reason;
pub use target::VideoTarget;

#[derive(Clone, Copy, Debug)]
pub enum VideoPlan {
    Copy,
    Encode(VideoTarget),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AudioPlan {
    Copy,
    Aac,
}

#[derive(Clone, Debug)]
pub struct Decision {
    pub mode: Mode,
    pub reasons: Vec<Reason>,
    pub video: Option<VideoPlan>,
    pub audio: Option<(u32, AudioPlan)>,
    pub burn_in: Option<u32>,
}

pub fn decide(media: &Media, request: &CreateSession, encoders: Encoders) -> AppResult<Decision> {
    let client = &request.client;
    if client.player == Player::Mpv {
        return Ok(Decision { mode: Mode::Direct, reasons: Vec::new(), video: None, audio: None, burn_in: None });
    }
    let audio = chosen_audio(media, request.audio_track)?;
    let burn_in = chosen_burn_in(media, request.subtitle_track)?;
    let mut reasons = browser::container_reasons(media, audio, client);
    if let Some(video) = &media.video {
        reasons.extend(browser::video_reasons(video, client));
    }
    if let Some(audio) = audio {
        reasons.extend(browser::audio_reasons(media, audio, client));
    }
    if burn_in.is_some() {
        reasons.push(Reason::SubtitleCodecNotSupported);
    }
    if reasons.is_empty() {
        return Ok(Decision { mode: Mode::Direct, reasons, video: None, audio: None, burn_in: None });
    }
    let audio = audio.map(|audio| (audio.index, audio_plan(audio, client)));
    let copies_video = media.video.as_ref().is_none_or(|video| browser::HLS_VIDEO_CODECS.contains(&video.codec.as_str()));
    if copies_video && reasons.iter().all(|reason| reason.allows_video_copy()) {
        let mode = if audio.is_some_and(|(_, plan)| plan == AudioPlan::Aac) { Mode::Audio } else { Mode::Remux };
        return Ok(Decision { mode, reasons, video: media.video.as_ref().map(|_| VideoPlan::Copy), audio, burn_in });
    }
    if !copies_video && !reasons.contains(&Reason::VideoCodecNotSupported) {
        reasons.push(Reason::VideoCodecNotSupported);
    }
    let video = media.video.as_ref().map(|video| VideoPlan::Encode(target::video_target(video, client, encoders, burn_in.is_some())));
    Ok(Decision { mode: Mode::Transcode, reasons, video, audio, burn_in })
}

fn audio_plan(audio: &AudioStream, client: &ClientProfile) -> AudioPlan {
    if browser::hls_copies_audio(audio, client) { AudioPlan::Copy } else { AudioPlan::Aac }
}

fn chosen_audio(media: &Media, requested: Option<u32>) -> AppResult<Option<&AudioStream>> {
    match requested {
        Some(index) => media.audio(index).map(Some).ok_or_else(|| AppError::bad_request(format!("No audio track {index}."))),
        None => Ok(media.default_audio()),
    }
}

fn chosen_burn_in(media: &Media, requested: Option<u32>) -> AppResult<Option<u32>> {
    let Some(index) = requested else { return Ok(None) };
    let subtitle = media.subtitle(index).ok_or_else(|| AppError::bad_request(format!("No subtitle track {index}.")))?;
    match subtitle.kind {
        SubtitleKind::Image if media.video.is_some() => Ok(Some(index)),
        SubtitleKind::Image | SubtitleKind::Other => Err(AppError::new(StatusCode::UNPROCESSABLE_ENTITY, format!("Subtitle track {index} can't be shown."))),
        SubtitleKind::Text => Ok(None),
    }
}
