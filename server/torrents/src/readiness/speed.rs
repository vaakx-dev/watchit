const FAST_HALF_LIFE: f64 = 3.0;
const SLOW_HALF_LIFE: f64 = 9.0;

#[derive(Clone, Copy)]
struct Ewma {
    half_life: f64,
    estimate: f64,
    weight: f64,
}

impl Ewma {
    fn new(half_life: f64) -> Self {
        Self { half_life, estimate: 0.0, weight: 0.0 }
    }

    fn decay(&self, seconds: f64) -> f64 {
        0.5f64.powf(seconds / self.half_life)
    }

    fn update(&mut self, seconds: f64, sample: f64) {
        let keep = self.decay(seconds);
        self.estimate = sample * (1.0 - keep) + keep * self.estimate;
        self.weight += seconds;
    }

    fn value(&self) -> f64 {
        if self.weight <= 0.0 { 0.0 } else { self.estimate / (1.0 - self.decay(self.weight)) }
    }
}

#[derive(Clone, Copy)]
pub struct Smoother {
    fast: Ewma,
    slow: Ewma,
}

impl Default for Smoother {
    fn default() -> Self {
        Self { fast: Ewma::new(FAST_HALF_LIFE), slow: Ewma::new(SLOW_HALF_LIFE) }
    }
}

impl Smoother {
    pub fn update(&mut self, seconds: f64, bytes_per_second: f64) {
        self.fast.update(seconds, bytes_per_second);
        self.slow.update(seconds, bytes_per_second);
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    pub fn bytes_per_second(&self) -> f64 {
        self.fast.value().min(self.slow.value())
    }
}
