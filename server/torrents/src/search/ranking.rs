use std::cmp::Ordering;

use super::result::Candidate;
use crate::release::Resolution;

const MEGABITS_PER_SWARM_DOUBLING: f64 = 10.0;
const COMFORTABLE_HEADROOM: f64 = 1.5;
const BITRATE_PENALTY_WEIGHT: f64 = 3.0;
const DOLBY_VISION_WITHOUT_FALLBACK_PENALTY: f64 = 3.0;
const REMUX_PENALTY: f64 = 2.0;
const DISC_IMAGE_PENALTY: f64 = 6.0;
const THREE_D_PENALTY: f64 = 4.0;

fn tier(candidate: &Candidate) -> u8 {
    let alive = candidate.result.seeders.is_none_or(|seeders| seeders > 0);
    let quality = match (candidate.traits.cam, candidate.result.resolution) {
        (true, _) => 7,
        (false, Some(Resolution::Uhd)) => 0,
        (false, Some(Resolution::Qhd)) => 1,
        (false, Some(Resolution::FullHd)) => 2,
        (false, Some(Resolution::Hd)) => 3,
        (false, Some(Resolution::Sd)) => 4,
        (false, Some(Resolution::Low)) => 5,
        (false, None) => 6,
    };
    if alive { quality } else { 10 + quality }
}

fn swarm_doublings(candidate: &Candidate) -> f64 {
    (f64::from(candidate.result.seeders.unwrap_or(1)) + 1.0).log2()
}

fn bitrate_megabits(candidate: &Candidate, runtime_minutes: Option<u32>) -> Option<f64> {
    let seconds = f64::from(runtime_minutes.filter(|minutes| *minutes > 0)?) * 60.0;
    let bytes = candidate.result.size_bytes? as f64;
    Some(bytes * 8.0 / seconds / 1_000_000.0)
}

fn bitrate_penalty(candidate: &Candidate, runtime_minutes: Option<u32>) -> f64 {
    let Some(bitrate) = bitrate_megabits(candidate, runtime_minutes) else { return 0.0 };
    let capacity = MEGABITS_PER_SWARM_DOUBLING * swarm_doublings(candidate);
    let headroom = capacity / bitrate.max(0.1);
    if headroom >= COMFORTABLE_HEADROOM { 0.0 } else { BITRATE_PENALTY_WEIGHT * (COMFORTABLE_HEADROOM / headroom.max(0.01)).log2() }
}

fn format_penalty(candidate: &Candidate) -> f64 {
    let traits = &candidate.traits;
    [
        (traits.dolby_vision_without_fallback, DOLBY_VISION_WITHOUT_FALLBACK_PENALTY),
        (traits.remux, REMUX_PENALTY),
        (traits.disc_image, DISC_IMAGE_PENALTY),
        (traits.three_d, THREE_D_PENALTY),
    ]
    .into_iter()
    .filter(|(applies, _)| *applies)
    .map(|(_, penalty)| penalty)
    .sum()
}

fn score(candidate: &Candidate, runtime_minutes: Option<u32>) -> f64 {
    swarm_doublings(candidate) - bitrate_penalty(candidate, runtime_minutes) - format_penalty(candidate)
}

pub fn rank(candidates: &mut [Candidate], runtime_minutes: Option<u32>) {
    candidates.sort_by(|a, b| {
        tier(a)
            .cmp(&tier(b))
            .then_with(|| score(b, runtime_minutes).partial_cmp(&score(a, runtime_minutes)).unwrap_or(Ordering::Equal))
            .then_with(|| b.result.seeders.cmp(&a.result.seeders))
    });
}
