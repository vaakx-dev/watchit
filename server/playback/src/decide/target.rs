use super::browser::{frame_box, supports};
use crate::api::ClientProfile;
use crate::ffmpeg::Encoders;
use crate::probe::{Transfer, VideoStream};

#[derive(Clone, Copy, Debug)]
pub struct VideoTarget {
    pub width: u32,
    pub height: u32,
    pub keep_hdr: Option<Transfer>,
    pub tonemap: bool,
}

pub fn video_target(video: &VideoStream, client: &ClientProfile, encoders: Encoders, burns_in: bool) -> VideoTarget {
    let (width, height) = fit(video, frame_box(client));
    let hdr = video.displayed_transfer().filter(|transfer| *transfer != Transfer::Sdr);
    let keeps_hdr = client.hdr && supports(&client.video_codecs, "hevc") && encoders.hevc_nvenc && !burns_in;
    let keep_hdr = hdr.filter(|_| keeps_hdr);
    VideoTarget {
        width,
        height,
        keep_hdr,
        tonemap: video.is_hdr() && keep_hdr.is_none(),
    }
}

fn fit(video: &VideoStream, (max_width, max_height): (u32, u32)) -> (u32, u32) {
    let (width, height) = (f64::from(video.width.max(2)), f64::from(video.height.max(2)));
    let scale = (f64::from(max_width) / width).min(f64::from(max_height) / height).min(1.0);
    (even(width * scale), even(height * scale))
}

fn even(value: f64) -> u32 {
    ((value / 2.0).round() as u32 * 2).max(2)
}
