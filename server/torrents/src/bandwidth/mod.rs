mod hold;
mod pacer;
pub mod routes;
mod schedule;
mod status;
mod steer;
mod store;

use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use chrono::{DateTime, Local};
use librqbit::limits::LimitsConfig;

pub use hold::hold_background;
pub use schedule::Schedule;
pub use status::{SpeedMode, SpeedStatus, WhileWatching};
pub use store::{create_table, load};

use crate::settings::Settings;
use pacer::Pacer;

const WATCHING_GRACE: Duration = Duration::from_secs(15);
const PAUSED_WHILE_WATCHING: &str = "Paused while you're watching.";
const LIMITED_WHILE_WATCHING: &str = "Waiting its turn while you're watching.";

pub struct Observation {
    pub reading: bool,
    pub background: HashMap<String, u64>,
}

#[derive(Default)]
pub struct Steering {
    pub limits: Option<LimitsConfig>,
    pub status: Option<SpeedStatus>,
    pub alternative: Option<bool>,
}

fn limits(settings: &Settings, alternative: bool) -> LimitsConfig {
    let (download, upload) = if alternative {
        (settings.alt_download_bps, settings.alt_upload_bps)
    } else {
        (settings.max_download_bps, settings.max_upload_bps)
    };
    LimitsConfig { download_bps: download.and_then(NonZeroU32::new), upload_bps: upload.and_then(NonZeroU32::new) }
}

fn background_limit(settings: &Settings, alternative: bool) -> u32 {
    let allowed = match settings.while_watching {
        WhileWatching::Throttle => settings.while_watching_bps.unwrap_or(0),
        WhileWatching::Pause | WhileWatching::None => 0,
    };
    limits(settings, alternative).download_bps.map_or(allowed, |global| global.get().min(allowed))
}

fn status(settings: &Settings, alternative: bool, watching: bool) -> SpeedStatus {
    let global = limits(settings, alternative);
    SpeedStatus {
        mode: match (watching, alternative) {
            (true, _) => SpeedMode::Watching,
            (false, true) => SpeedMode::Alternative,
            (false, false) => SpeedMode::Normal,
        },
        alternative,
        download_bps_limit: if watching { Some(background_limit(settings, alternative)) } else { global.download_bps.map(NonZeroU32::get) },
        upload_bps_limit: global.upload_bps.map(NonZeroU32::get),
    }
}

struct State {
    alternative: bool,
    scheduled: Option<bool>,
    watching_until: Option<Instant>,
    pacer: Option<Pacer>,
    hold: Option<&'static str>,
    applied: LimitsConfig,
    status: SpeedStatus,
}

impl State {
    fn follow_schedule(&mut self, schedule: &Schedule, local: &DateTime<Local>) -> Option<bool> {
        if !schedule.enabled {
            self.scheduled = None;
            return None;
        }
        let inside = schedule.contains(local);
        if self.scheduled == Some(inside) {
            return None;
        }
        self.scheduled = Some(inside);
        self.alternative = inside;
        Some(inside)
    }

    fn watching(&mut self, settings: &Settings, now: Instant, reading: bool) -> bool {
        if reading {
            self.watching_until = Some(now + WATCHING_GRACE);
        }
        settings.while_watching != WhileWatching::None && self.watching_until.is_some_and(|until| now < until)
    }

    fn hold(&mut self, settings: &Settings, watching: bool, now: Instant, background: HashMap<String, u64>) -> Option<&'static str> {
        if !watching || settings.while_watching != WhileWatching::Throttle {
            self.pacer = None;
        }
        if !watching {
            return None;
        }
        if settings.while_watching != WhileWatching::Throttle {
            return Some(PAUSED_WHILE_WATCHING);
        }
        let bps = background_limit(settings, self.alternative);
        let pacer = self.pacer.get_or_insert_with(|| Pacer::new(now));
        pacer.holds(bps, now, background).then_some(LIMITED_WHILE_WATCHING)
    }
}

pub struct Bandwidth {
    state: Mutex<State>,
}

impl Bandwidth {
    pub fn new(settings: &Settings, alternative: bool) -> Self {
        Self {
            state: Mutex::new(State {
                alternative,
                scheduled: None,
                watching_until: None,
                pacer: None,
                hold: None,
                applied: limits(settings, alternative),
                status: status(settings, alternative, false),
            }),
        }
    }

    fn state(&self) -> MutexGuard<'_, State> {
        self.state.lock().expect("bandwidth lock")
    }

    pub fn limits(&self) -> LimitsConfig {
        self.state().applied
    }

    pub fn status(&self) -> SpeedStatus {
        self.state().status
    }

    pub fn hold(&self) -> Option<&'static str> {
        self.state().hold
    }

    pub fn set_alternative(&self, alternative: bool) {
        self.state().alternative = alternative;
    }

    pub fn reschedule(&self) {
        self.state().scheduled = None;
    }

    pub fn steer(&self, settings: &Settings, local: &DateTime<Local>, now: Instant, observation: Observation) -> Steering {
        let mut state = self.state();
        let alternative = state.follow_schedule(&settings.schedule, local);
        let watching = state.watching(settings, now, observation.reading);
        state.hold = state.hold(settings, watching, now, observation.background);
        let applied = limits(settings, state.alternative);
        let status = status(settings, state.alternative, watching);
        let steering = Steering {
            limits: (state.applied != applied).then_some(applied),
            status: (state.status != status).then_some(status),
            alternative,
        };
        state.applied = applied;
        state.status = status;
        steering
    }
}
