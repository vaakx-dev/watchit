use super::model::{Readiness, Verdict};

const MIB: f64 = 1024.0 * 1024.0;
const MIN_START_BYTES: f64 = 10.0 * MIB;
const START_SECONDS: f64 = 5.0;
const SPEED_SAFETY: f64 = 0.8;

pub struct Inputs {
    pub size_bytes: u64,
    pub position: u64,
    pub have_ahead: u64,
    pub runtime_seconds: Option<f64>,
    pub speed: f64,
    pub running: bool,
    pub was_ready: bool,
}

pub fn estimate(inputs: &Inputs) -> Readiness {
    let rest = inputs.size_bytes.saturating_sub(inputs.position) as f64;
    let bitrate = inputs
        .runtime_seconds
        .filter(|seconds| *seconds > 0.0)
        .map(|seconds| inputs.size_bytes as f64 / seconds);
    let bitrate_bps = bitrate.map(|bitrate| bitrate.round() as u64);
    let have = inputs.have_ahead as f64;
    if have >= rest {
        return Readiness {
            state: Verdict::Ready,
            ready_in_seconds: Some(0),
            bitrate_bps,
        };
    }
    let Some(bitrate) = bitrate.filter(|_| inputs.running) else {
        return Readiness {
            state: Verdict::Unknown,
            ready_in_seconds: None,
            bitrate_bps,
        };
    };
    let speed = inputs.speed * if inputs.was_ready { 1.0 } else { SPEED_SAFETY };
    let start = MIN_START_BYTES.max(bitrate * START_SECONDS);
    let sustain = (bitrate - speed).max(0.0) * (rest / bitrate);
    let needed = start.max(sustain).min(rest);
    if have >= needed {
        return Readiness {
            state: Verdict::Ready,
            ready_in_seconds: Some(0),
            bitrate_bps,
        };
    }
    let ready_in_seconds = (speed > 0.0).then(|| ((needed - have) / speed).ceil() as u64);
    Readiness {
        state: Verdict::Waiting,
        ready_in_seconds,
        bitrate_bps,
    }
}
