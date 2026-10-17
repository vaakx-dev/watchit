mod contiguous;
mod estimate;
mod model;
mod playhead;
mod sample;
mod speed;
mod target;

use std::collections::HashMap;

pub use model::{Readiness, Verdict};
pub use playhead::Slot;

#[derive(Default)]
pub struct Tracker {
    pub speed: speed::Smoother,
    pub playhead: Slot,
    pub current: Readiness,
    runtimes: HashMap<String, u32>,
    target: Option<usize>,
}
