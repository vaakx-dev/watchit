use axum::http::StatusCode;
use watchit_core::{AppError, AppResult};

use super::segments::{SEGMENT_SECONDS, Segment, equal_segments, gop_frames, keyframe_segments};
use super::video::{Encode, strings};
use crate::decide::{AudioPlan, Decision, VideoPlan};
use crate::ffmpeg::Encoders;
use crate::probe::Media;
use crate::source::SourceInput;

const RUN_SECONDS: f64 = 900.0;
const DEFAULT_FRAME_RATE: f64 = 24.0;
const KEYFRAME_SEEK_OFFSET: f64 = 0.5;
const KEYFRAME_SEEK_MARGIN: f64 = 0.04;

#[derive(Clone, Debug)]
enum Video {
    Copy { stream: u32, strip_dolby_vision: bool },
    Encode(Encode),
}

#[derive(Clone, Debug)]
pub struct Recipe {
    pub input: SourceInput,
    pub segments: Vec<Segment>,
    keyframes: Option<Vec<f64>>,
    video: Option<Video>,
    audio: Option<(u32, AudioPlan)>,
}

impl Recipe {
    pub fn new(input: SourceInput, media: &Media, decision: &Decision, keyframes: Option<Vec<f64>>, encoders: Encoders) -> AppResult<Self> {
        let duration = media.duration.ok_or_else(|| AppError::new(StatusCode::UNPROCESSABLE_ENTITY, "The video has no known duration."))?;
        let (video, segments, keyframes) = match (decision.video, &media.video) {
            (Some(VideoPlan::Copy), Some(stream)) => {
                let video = Video::Copy { stream: stream.index, strip_dolby_vision: stream.dolby_vision.is_some() && stream.codec == "hevc" };
                let segments = match &keyframes {
                    Some(keyframes) => keyframe_segments(keyframes, duration),
                    None => equal_segments(duration, SEGMENT_SECONDS),
                };
                (Some(video), segments, keyframes)
            }
            (Some(VideoPlan::Encode(target)), Some(stream)) => {
                let frame_rate = stream.frame_rate.unwrap_or(DEFAULT_FRAME_RATE);
                let gop = gop_frames(frame_rate);
                let nvenc = if target.keep_hdr.is_some() { encoders.hevc_nvenc } else { encoders.h264_nvenc };
                let encode = Encode::new(stream, target, nvenc, gop, decision.burn_in);
                (Some(Video::Encode(encode)), equal_segments(duration, f64::from(gop) / frame_rate), None)
            }
            _ => (None, equal_segments(duration, SEGMENT_SECONDS), None),
        };
        Ok(Self { input, segments, keyframes, video, audio: decision.audio })
    }

    pub fn run_end(&self, first: usize) -> usize {
        let limit = self.segments[first].start + RUN_SECONDS;
        let after = self.segments[first..].iter().position(|segment| segment.start >= limit).map_or(self.segments.len(), |offset| first + offset);
        after.max(first + 1)
    }

    pub fn arguments(&self, first: usize, end: usize) -> Vec<String> {
        let mut args = strings(&["-hide_banner", "-nostats", "-loglevel", "verbose"]);
        if let Some(Video::Encode(encode)) = &self.video {
            args.extend(encode.input_args());
        }
        if matches!(self.video, Some(Video::Copy { .. })) {
            args.extend(strings(&["-fflags", "+genpts"]));
        }
        let seek = self.seek(first);
        if seek > 0.0 {
            args.extend(strings(&["-ss", &seconds(seek)]));
        }
        if let Some(next) = self.segments.get(end) {
            args.extend(strings(&["-t", &seconds(next.start - seek)]));
        }
        args.extend(strings(&["-i", &self.input.ffmpeg_input()]));
        args.extend(self.video_args());
        args.extend(self.audio_args());
        args.extend(strings(&["-map_metadata", "-1", "-map_chapters", "-1", "-copyts", "-start_at_zero", "-avoid_negative_ts", "disabled", "-max_muxing_queue_size", "2048"]));
        args.extend(strings(&["-f", "segment", "-segment_format", "mpegts", "-segment_start_number", &first.to_string()]));
        let origin = self.segments[first].start;
        let cuts: Vec<String> = self.segments[first + 1..end].iter().map(|segment| seconds(segment.start - origin)).collect();
        if !cuts.is_empty() {
            args.extend(strings(&["-segment_times", &cuts.join(","), "-segment_time_delta", "0.05"]));
        }
        args.extend(strings(&["-y", "%d.ts"]));
        args
    }

    fn seek(&self, first: usize) -> f64 {
        let start = self.segments[first].start;
        let Some(keyframes) = self.keyframes.as_ref().filter(|_| start > 0.0) else { return start };
        let next = keyframes.iter().find(|keyframe| **keyframe > start).copied().unwrap_or(f64::INFINITY);
        start + KEYFRAME_SEEK_OFFSET.min(next - start - KEYFRAME_SEEK_MARGIN).max(0.0)
    }

    fn video_args(&self) -> Vec<String> {
        match &self.video {
            None => Vec::new(),
            Some(Video::Copy { stream, strip_dolby_vision }) => {
                let mut args = strings(&["-map", &format!("0:{stream}"), "-c:v", "copy"]);
                if *strip_dolby_vision {
                    args.extend(strings(&["-bsf:v", "hevc_metadata=remove_dovi=1"]));
                }
                args
            }
            Some(Video::Encode(encode)) => encode.output_args(),
        }
    }

    fn audio_args(&self) -> Vec<String> {
        let Some((stream, plan)) = self.audio else { return Vec::new() };
        let mut args = strings(&["-map", &format!("0:{stream}")]);
        match plan {
            AudioPlan::Copy => args.extend(strings(&["-c:a", "copy"])),
            AudioPlan::Aac => args.extend(strings(&["-c:a", "aac", "-ac", "2", "-b:a", "192k"])),
        }
        args
    }
}

fn seconds(value: f64) -> String {
    format!("{value:.6}")
}
