use chrono::{DateTime, Datelike, Local, Timelike};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

const MINUTES_PER_DAY: i64 = 24 * 60;
const MINUTES_PER_WEEK: i64 = 7 * MINUTES_PER_DAY;
const SATURDAY: u8 = 6;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/", rename = "SpeedSchedule")]
pub struct Schedule {
    pub enabled: bool,
    pub days: Vec<u8>,
    pub from: String,
    pub to: String,
}

fn minute_of_day(time: &str) -> Option<i64> {
    let (hours, minutes) = time.split_once(':')?;
    if hours.len() != 2 || minutes.len() != 2 {
        return None;
    }
    let (hours, minutes): (i64, i64) = (hours.parse().ok()?, minutes.parse().ok()?);
    (hours < 24 && minutes < 60).then_some(hours * 60 + minutes)
}

impl Schedule {
    pub fn defaults() -> Self {
        Self { enabled: false, days: (0..=SATURDAY).collect(), from: "09:00".to_owned(), to: "17:00".to_owned() }
    }

    pub fn validated(mut self) -> AppResult<Self> {
        if self.days.iter().any(|day| *day > SATURDAY) {
            return Err(AppError::bad_request("Schedule days run from 0 (Sunday) to 6 (Saturday)."));
        }
        self.days.sort_unstable();
        self.days.dedup();
        if self.enabled && self.days.is_empty() {
            return Err(AppError::bad_request("Pick at least one day for the schedule."));
        }
        if minute_of_day(&self.from).is_none() || minute_of_day(&self.to).is_none() {
            return Err(AppError::bad_request("Schedule times use the 24-hour HH:MM format."));
        }
        Ok(self)
    }

    pub fn contains(&self, time: &DateTime<Local>) -> bool {
        let (Some(begin), Some(end)) = (minute_of_day(&self.from), minute_of_day(&self.to)) else { return false };
        let length = if end > begin { end - begin } else { end + MINUTES_PER_DAY - begin };
        let now = i64::from(time.weekday().num_days_from_sunday()) * MINUTES_PER_DAY + i64::from(time.hour() * 60 + time.minute());
        self.days.iter().any(|day| (now - i64::from(*day) * MINUTES_PER_DAY - begin).rem_euclid(MINUTES_PER_WEEK) < length)
    }
}
