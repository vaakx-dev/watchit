use chrono::{DateTime, SecondsFormat};

pub(crate) const HOUR_MS: i64 = 3_600_000;
pub(crate) const DAY_MS: i64 = 24 * HOUR_MS;

pub(crate) fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub(crate) fn iso(ms: i64) -> String {
    DateTime::from_timestamp_millis(ms).map(|time| time.to_rfc3339_opts(SecondsFormat::Millis, true)).unwrap_or_default()
}

pub(crate) fn day(ms: i64) -> String {
    DateTime::from_timestamp_millis(ms).map(|time| time.format("%Y-%m-%d").to_string()).unwrap_or_default()
}
