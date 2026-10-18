use std::cmp::Ordering;

use super::result::Candidate;
use crate::quality::Quality;

const MEGABITS_PER_SWARM_DOUBLING: f64 = 10.0;
const COMFORTABLE_HEADROOM: f64 = 1.5;
const MIN_HEALTHY_SEEDERS: u32 = 3;
const BITRATE_PENALTY_WEIGHT: f64 = 3.0;
const DOLBY_VISION_WITHOUT_FALLBACK_PENALTY: f64 = 3.0;
const REMUX_PENALTY: f64 = 2.0;
const DISC_IMAGE_PENALTY: f64 = 6.0;
const THREE_D_PENALTY: f64 = 4.0;

fn swarm_doublings(candidate: &Candidate) -> f64 {
    (f64::from(candidate.result.seeders.unwrap_or(1)) + 1.0).log2()
}

fn bitrate_megabits(candidate: &Candidate, runtime_minutes: Option<u32>) -> Option<f64> {
    let seconds = f64::from(runtime_minutes.filter(|minutes| *minutes > 0)?) * 60.0;
    let bytes = candidate.result.size_bytes? as f64;
    Some(bytes * 8.0 / seconds / 1_000_000.0)
}

fn swarm_capacity_megabits(candidate: &Candidate) -> f64 {
    MEGABITS_PER_SWARM_DOUBLING * swarm_doublings(candidate)
}

fn streamable(candidate: &Candidate, runtime_minutes: Option<u32>) -> bool {
    let enough_seeders = candidate.result.seeders.is_some_and(|seeders| seeders >= MIN_HEALTHY_SEEDERS);
    let keeps_up =
        bitrate_megabits(candidate, runtime_minutes).is_none_or(|bitrate| swarm_capacity_megabits(candidate) >= bitrate * COMFORTABLE_HEADROOM);
    enough_seeders && keeps_up
}

fn bitrate_penalty(candidate: &Candidate, runtime_minutes: Option<u32>) -> f64 {
    let Some(bitrate) = bitrate_megabits(candidate, runtime_minutes) else {
        return 0.0;
    };
    let headroom = swarm_capacity_megabits(candidate) / bitrate.max(0.1);
    if headroom >= COMFORTABLE_HEADROOM {
        0.0
    } else {
        BITRATE_PENALTY_WEIGHT * (COMFORTABLE_HEADROOM / headroom.max(0.01)).log2()
    }
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

fn order(a: &Candidate, b: &Candidate, quality: &Quality, runtime_minutes: Option<u32>) -> Ordering {
    let dead = |candidate: &Candidate| candidate.result.seeders == Some(0);
    dead(a)
        .cmp(&dead(b))
        .then_with(|| a.traits.cam.cmp(&b.traits.cam))
        .then_with(|| quality.avoids(a).cmp(&quality.avoids(b)))
        .then_with(|| streamable(b, runtime_minutes).cmp(&streamable(a, runtime_minutes)))
        .then_with(|| {
            quality
                .resolution_rank(a.result.resolution)
                .cmp(&quality.resolution_rank(b.result.resolution))
        })
        .then_with(|| quality.likes(b).cmp(&quality.likes(a)))
        .then_with(|| {
            score(b, runtime_minutes)
                .partial_cmp(&score(a, runtime_minutes))
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| b.result.seeders.cmp(&a.result.seeders))
}

pub fn rank(candidates: &mut [Candidate], quality: &Quality, runtime_minutes: Option<u32>) {
    candidates.sort_by(|a, b| order(a, b, quality, runtime_minutes));
}
