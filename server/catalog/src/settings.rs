use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::{Connection, OptionalExtension};
use watchit_core::{AppError, AppResult};

use crate::clock::HOUR_MS;

const KEY: &str = "metadata_hours";
const DEFAULT_HOURS: f64 = 24.0;

#[derive(Clone)]
pub(crate) struct MetadataHours(Arc<AtomicU64>);

impl MetadataHours {
    pub fn load(conn: &Connection) -> AppResult<Self> {
        let stored: Option<f64> =
            conn.query_row("SELECT value FROM catalog_settings WHERE key = ?1", [KEY], |row| row.get(0)).optional()?;
        Ok(Self(Arc::new(AtomicU64::new(stored.unwrap_or(DEFAULT_HOURS).to_bits()))))
    }

    pub fn hours(&self) -> f64 {
        f64::from_bits(self.0.load(Ordering::Relaxed))
    }

    pub fn ms(&self) -> i64 {
        (self.hours() * HOUR_MS as f64) as i64
    }

    pub fn validate(hours: f64) -> AppResult<()> {
        if hours.is_finite() && (0.25..=8760.0).contains(&hours) {
            Ok(())
        } else {
            Err(AppError::bad_request(format!("Invalid cache setting: {KEY}")))
        }
    }

    pub fn set(&self, conn: &Connection, hours: f64) -> AppResult<()> {
        conn.execute(
            "INSERT INTO catalog_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![KEY, hours],
        )?;
        self.0.store(hours.to_bits(), Ordering::Relaxed);
        Ok(())
    }
}
