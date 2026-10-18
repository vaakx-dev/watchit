use std::collections::HashMap;

use serde::Deserialize;
use watchit_core::{AppError, AppResult};

use super::media::{AudioStream, DolbyVision, Media, SubtitleKind, SubtitleStream, Transfer, VideoStream};
use crate::ffmpeg::Tools;
use crate::source::SourceInput;

const TEXT_SUBTITLES: [&str; 7] = ["subrip", "ass", "ssa", "webvtt", "mov_text", "text", "microdvd"];
const IMAGE_SUBTITLES: [&str; 4] = ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"];

#[derive(Deserialize)]
struct Output {
    format: Option<Format>,
    #[serde(default)]
    streams: Vec<Stream>,
}

#[derive(Deserialize)]
struct Format {
    format_name: Option<String>,
    start_time: Option<String>,
    duration: Option<String>,
}

#[derive(Deserialize)]
struct Stream {
    index: u32,
    codec_type: Option<String>,
    codec_name: Option<String>,
    pix_fmt: Option<String>,
    bits_per_raw_sample: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
    r_frame_rate: Option<String>,
    color_transfer: Option<String>,
    channels: Option<u32>,
    #[serde(default)]
    disposition: HashMap<String, i64>,
    #[serde(default)]
    tags: HashMap<String, String>,
    #[serde(default)]
    side_data_list: Vec<SideData>,
}

#[derive(Deserialize)]
struct SideData {
    side_data_type: Option<String>,
    dv_bl_signal_compatibility_id: Option<u32>,
}

pub async fn probe(tools: &Tools, input: &SourceInput) -> AppResult<Media> {
    let output = tools
        .ffprobe()
        .args(["-v", "error", "-show_format", "-show_streams", "-of", "json"])
        .arg(input.ffmpeg_input())
        .output()
        .await
        .map_err(AppError::internal)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            axum::http::StatusCode::UNPROCESSABLE_ENTITY,
            format!("Could not read the video: {}", stderr.trim()),
        ));
    }
    let parsed: Output = serde_json::from_slice(&output.stdout).map_err(AppError::internal)?;
    Ok(media(parsed))
}

fn media(output: Output) -> Media {
    let format = output.format;
    let formats = format
        .as_ref()
        .and_then(|format| format.format_name.as_deref())
        .unwrap_or_default()
        .split(',')
        .map(str::to_owned)
        .collect();
    let start = format.as_ref().and_then(|format| seconds(format.start_time.as_deref())).unwrap_or(0.0);
    let duration = format
        .as_ref()
        .and_then(|format| seconds(format.duration.as_deref()))
        .filter(|duration| *duration > 0.0);
    let streams = &output.streams;
    let video = of_type(streams, "video")
        .filter(|stream| !flag(stream, "attached_pic"))
        .min_by_key(|stream| !flag(stream, "default"))
        .map(video_stream);
    Media {
        formats,
        start,
        duration,
        video,
        audio: of_type(streams, "audio").map(audio_stream).collect(),
        subtitles: of_type(streams, "subtitle").map(subtitle_stream).collect(),
    }
}

fn of_type<'a>(streams: &'a [Stream], kind: &'a str) -> impl Iterator<Item = &'a Stream> {
    streams.iter().filter(move |stream| stream.codec_type.as_deref() == Some(kind))
}

fn video_stream(stream: &Stream) -> VideoStream {
    let pixel_format = stream.pix_fmt.clone().unwrap_or_default();
    VideoStream {
        index: stream.index,
        codec: codec(stream),
        bit_depth: bit_depth(stream, &pixel_format),
        pixel_format,
        width: stream.width.unwrap_or(0),
        height: stream.height.unwrap_or(0),
        frame_rate: rate(stream.avg_frame_rate.as_deref()).or_else(|| rate(stream.r_frame_rate.as_deref())),
        transfer: transfer(stream.color_transfer.as_deref()),
        dolby_vision: dolby_vision(stream),
    }
}

fn audio_stream(stream: &Stream) -> AudioStream {
    AudioStream {
        index: stream.index,
        codec: codec(stream),
        channels: stream.channels.unwrap_or(2),
        language: tag(stream, "language"),
        title: tag(stream, "title"),
        default: flag(stream, "default"),
    }
}

fn subtitle_stream(stream: &Stream) -> SubtitleStream {
    let codec = codec(stream);
    let kind = if TEXT_SUBTITLES.contains(&codec.as_str()) {
        SubtitleKind::Text
    } else if IMAGE_SUBTITLES.contains(&codec.as_str()) {
        SubtitleKind::Image
    } else {
        SubtitleKind::Other
    };
    SubtitleStream {
        index: stream.index,
        codec,
        kind,
        language: tag(stream, "language"),
        title: tag(stream, "title"),
        default: flag(stream, "default"),
    }
}

fn codec(stream: &Stream) -> String {
    stream.codec_name.clone().unwrap_or_default()
}

fn flag(stream: &Stream, name: &str) -> bool {
    stream.disposition.get(name).is_some_and(|value| *value != 0)
}

fn tag(stream: &Stream, name: &str) -> Option<String> {
    stream
        .tags
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.clone())
        .filter(|value| !value.is_empty() && value != "und")
}

fn seconds(value: Option<&str>) -> Option<f64> {
    value?.parse::<f64>().ok().filter(|seconds| seconds.is_finite())
}

fn rate(value: Option<&str>) -> Option<f64> {
    let (numerator, denominator) = value?.split_once('/')?;
    let rate = numerator.parse::<f64>().ok()? / denominator.parse::<f64>().ok()?;
    (rate.is_finite() && rate > 0.0).then_some(rate)
}

fn bit_depth(stream: &Stream, pixel_format: &str) -> u32 {
    if let Some(bits) = stream.bits_per_raw_sample.as_deref().and_then(|bits| bits.parse().ok()) {
        return bits;
    }
    if pixel_format.contains("12") {
        12
    } else if pixel_format.contains("10") {
        10
    } else {
        8
    }
}

fn transfer(value: Option<&str>) -> Transfer {
    match value {
        Some("smpte2084") => Transfer::Pq,
        Some("arib-std-b67") => Transfer::Hlg,
        _ => Transfer::Sdr,
    }
}

fn dolby_vision(stream: &Stream) -> Option<DolbyVision> {
    let record = stream
        .side_data_list
        .iter()
        .find(|side| side.side_data_type.as_deref() == Some("DOVI configuration record"))?;
    let base = match record.dv_bl_signal_compatibility_id {
        Some(1 | 6) => Some(Transfer::Pq),
        Some(2) => Some(Transfer::Sdr),
        Some(4) => Some(Transfer::Hlg),
        _ => None,
    };
    Some(DolbyVision { base })
}
