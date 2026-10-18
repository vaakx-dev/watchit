use rusqlite::{Connection, params};
use serde::Serialize;
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

const DAY_MS: f64 = 86_400_000.0;
const MB: f64 = 1_048_576.0;

#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export_to = "artwork/")]
pub struct ImageSettings {
    pub images_days: f64,
    pub max_stale_days: f64,
    pub image_limit_mb: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct ImageSettingsPatch {
    pub images_days: Option<f64>,
    pub max_stale_days: Option<f64>,
    pub image_limit_mb: Option<f64>,
}

impl Default for ImageSettings {
    fn default() -> Self {
        Self {
            images_days: 30.0,
            max_stale_days: 7.0,
            image_limit_mb: 1024.0,
        }
    }
}

impl ImageSettings {
    pub const KEYS: [&str; 3] = ["images_days", "max_stale_days", "image_limit_mb"];

    pub(crate) fn lifetime_ms(&self, jitter: f64) -> i64 {
        (self.images_days * DAY_MS * (1.0 - jitter)) as i64
    }

    pub(crate) fn stale_ms(&self) -> i64 {
        (self.max_stale_days * DAY_MS) as i64
    }

    pub(crate) fn permanent_retry_ms(&self) -> i64 {
        (self.images_days * DAY_MS) as i64
    }

    pub(crate) fn limit_bytes(&self) -> i64 {
        (self.image_limit_mb * MB) as i64
    }

    fn slot(&mut self, key: &str) -> Option<&mut f64> {
        match key {
            "images_days" => Some(&mut self.images_days),
            "max_stale_days" => Some(&mut self.max_stale_days),
            "image_limit_mb" => Some(&mut self.image_limit_mb),
            _ => None,
        }
    }

    pub(crate) fn load(conn: &Connection) -> AppResult<Self> {
        let mut settings = Self::default();
        let mut statement = conn.prepare("SELECT key, value FROM artwork_settings")?;
        let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)))?;
        for row in rows {
            let (key, value) = row?;
            if let Some(slot) = settings.slot(&key) {
                *slot = value;
            }
        }
        Ok(settings)
    }

    pub(crate) fn apply(&self, patch: &ImageSettingsPatch, conn: &Connection) -> AppResult<Self> {
        let mut next = *self;
        for (key, value) in patch.entries() {
            *next.slot(key).expect("known setting") = value;
            conn.execute(
                "INSERT INTO artwork_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }
        Ok(next)
    }
}

impl ImageSettingsPatch {
    pub fn set(&mut self, key: &str, value: f64) -> bool {
        let slot = match key {
            "images_days" => &mut self.images_days,
            "max_stale_days" => &mut self.max_stale_days,
            "image_limit_mb" => &mut self.image_limit_mb,
            _ => return false,
        };
        *slot = Some(value);
        true
    }

    pub fn validate(&self) -> AppResult<()> {
        for (key, value) in self.entries() {
            let (minimum, maximum) = match key {
                "images_days" => (0.25, 365.0),
                "max_stale_days" => (0.0, 365.0),
                _ => (16.0, 10240.0),
            };
            if !value.is_finite() || value < minimum || value > maximum {
                return Err(AppError::bad_request(format!("Invalid cache setting: {key}")));
            }
        }
        Ok(())
    }

    fn entries(&self) -> impl Iterator<Item = (&'static str, f64)> {
        [
            ("images_days", self.images_days),
            ("max_stale_days", self.max_stale_days),
            ("image_limit_mb", self.image_limit_mb),
        ]
        .into_iter()
        .filter_map(|(key, value)| value.map(|value| (key, value)))
    }
}
