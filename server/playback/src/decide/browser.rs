use super::reasons::Reason;
use crate::api::ClientProfile;
use crate::probe::{AudioStream, Media, VideoStream};

pub const HLS_VIDEO_CODECS: [&str; 2] = ["h264", "hevc"];
const HLS_AUDIO_CODECS: [&str; 4] = ["aac", "ac3", "eac3", "mp3"];
const WEBM_CODECS: [&str; 5] = ["vp8", "vp9", "av1", "opus", "vorbis"];
const EIGHT_BIT_420: [&str; 2] = ["yuv420p", "yuvj420p"];

pub fn supports(list: &[String], name: &str) -> bool {
    list.iter().any(|item| item.eq_ignore_ascii_case(name))
}

pub fn frame_box(client: &ClientProfile) -> (u32, u32) {
    (client.max_height * 16 / 9, client.max_height)
}

pub fn container_reasons(media: &Media, audio: Option<&AudioStream>, client: &ClientProfile) -> Vec<Reason> {
    let names = container_names(media, audio);
    let supported = names.iter().any(|name| supports(&client.containers, name));
    if supported { Vec::new() } else { vec![Reason::ContainerNotSupported] }
}

fn container_names(media: &Media, audio: Option<&AudioStream>) -> Vec<String> {
    if !media.is_matroska() {
        return media.formats.clone();
    }
    let codecs = media.video.iter().map(|video| video.codec.as_str()).chain(audio.map(|audio| audio.codec.as_str()));
    let webm = codecs.into_iter().all(|codec| WEBM_CODECS.contains(&codec));
    let mut names = vec!["mkv".to_owned(), "matroska".to_owned()];
    if webm {
        names.push("webm".to_owned());
    }
    names
}

pub fn video_reasons(video: &VideoStream, client: &ClientProfile) -> Vec<Reason> {
    let mut reasons = Vec::new();
    if !supports(&client.video_codecs, &video.codec) {
        reasons.push(Reason::VideoCodecNotSupported);
    }
    if video.codec == "h264" && video.bit_depth > 8 {
        reasons.push(Reason::VideoBitDepthNotSupported);
    }
    if video.codec == "h264" && !EIGHT_BIT_420.contains(&video.pixel_format.as_str()) {
        reasons.push(Reason::VideoProfileNotSupported);
    }
    let (max_width, max_height) = frame_box(client);
    if video.width > max_width || video.height > max_height {
        reasons.push(Reason::VideoResolutionNotSupported);
    }
    let displayable = match video.displayed_transfer() {
        None => false,
        Some(crate::probe::Transfer::Sdr) => true,
        Some(_) => client.hdr,
    };
    if !displayable {
        reasons.push(Reason::VideoRangeTypeNotSupported);
    }
    reasons
}

pub fn audio_reasons(media: &Media, audio: &AudioStream, client: &ClientProfile) -> Vec<Reason> {
    let mut reasons = Vec::new();
    if !supports(&client.audio_codecs, &audio.codec) {
        reasons.push(Reason::AudioCodecNotSupported);
    }
    if media.audio.first().is_some_and(|first| first.index != audio.index) {
        reasons.push(Reason::SecondaryAudioNotSupported);
    }
    reasons
}

pub fn hls_copies_audio(audio: &AudioStream, client: &ClientProfile) -> bool {
    HLS_AUDIO_CODECS.contains(&audio.codec.as_str()) && supports(&client.audio_codecs, &audio.codec)
}
