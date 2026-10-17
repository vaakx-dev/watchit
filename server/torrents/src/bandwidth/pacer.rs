use std::collections::HashMap;
use std::time::{Duration, Instant};

const BURST: Duration = Duration::from_secs(30);

pub struct Pacer {
    allowance: f64,
    holding: bool,
    last: Instant,
    seen: HashMap<String, u64>,
}

impl Pacer {
    pub fn new(now: Instant) -> Self {
        Self { allowance: 0.0, holding: true, last: now, seen: HashMap::new() }
    }

    pub fn holds(&mut self, bps: u32, now: Instant, background: HashMap<String, u64>) -> bool {
        let elapsed = now.saturating_duration_since(self.last).as_secs_f64();
        self.last = now;
        let used: u64 = background.iter().map(|(hash, have)| have.saturating_sub(*self.seen.get(hash).unwrap_or(have))).sum();
        self.seen = background;
        let burst = f64::from(bps) * BURST.as_secs_f64();
        self.allowance = (self.allowance + f64::from(bps) * elapsed).min(burst) - used as f64;
        if self.holding && bps > 0 && self.allowance >= burst {
            self.holding = false;
        } else if !self.holding && self.allowance <= 0.0 {
            self.holding = true;
        }
        self.holding
    }
}
