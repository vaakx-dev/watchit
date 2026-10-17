pub const SEGMENT_SECONDS: f64 = 6.0;
const SHORTEST_TAIL: f64 = 1.0;

#[derive(Clone, Copy, Debug)]
pub struct Segment {
    pub start: f64,
    pub duration: f64,
}

pub fn gop_frames(frame_rate: f64) -> u32 {
    (SEGMENT_SECONDS * frame_rate).ceil() as u32
}

pub fn equal_segments(duration: f64, length: f64) -> Vec<Segment> {
    let mut lengths = vec![length; (duration / length).floor() as usize];
    let remainder = duration - lengths.len() as f64 * length;
    match lengths.last_mut() {
        Some(last) if remainder < SHORTEST_TAIL => *last += remainder,
        _ if remainder > 0.0 => lengths.push(remainder),
        _ => {}
    }
    from_lengths(lengths)
}

pub fn keyframe_segments(keyframes: &[f64], duration: f64) -> Vec<Segment> {
    let total = keyframes.last().map_or(duration, |last| duration.max(*last));
    let mut lengths = Vec::new();
    let mut last_cut = 0.0;
    let mut desired_cut = SEGMENT_SECONDS;
    for keyframe in keyframes.iter().copied() {
        if keyframe >= desired_cut {
            lengths.push(keyframe - last_cut);
            last_cut = keyframe;
            desired_cut += SEGMENT_SECONDS;
        }
    }
    if total > last_cut {
        lengths.push(total - last_cut);
    }
    from_lengths(lengths)
}

fn from_lengths(lengths: Vec<f64>) -> Vec<Segment> {
    let mut start = 0.0;
    lengths
        .into_iter()
        .map(|duration| {
            let segment = Segment { start, duration };
            start += duration;
            segment
        })
        .collect()
}

pub fn segment_at(segments: &[Segment], seconds: f64) -> usize {
    segments.iter().rposition(|segment| segment.start <= seconds).unwrap_or(0)
}
