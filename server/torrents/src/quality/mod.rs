pub mod routes;
mod rules;
mod store;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

pub use store::{create_table, load, save};

use crate::release::Resolution;

const MAX_LANGUAGES: usize = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "torrents/")]
pub enum Stance {
    Prefer,
    Allow,
    Avoid,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/", rename = "QualityPreferences")]
pub struct Quality {
    pub resolution: Resolution,
    pub hdr: Stance,
    pub dolby_vision: Stance,
    pub max_size_bytes: Option<u64>,
    pub languages: Vec<String>,
    pub hide_cam: bool,
}

impl Default for Quality {
    fn default() -> Self {
        Self {
            resolution: Resolution::Uhd,
            hdr: Stance::Allow,
            dolby_vision: Stance::Allow,
            max_size_bytes: None,
            languages: Vec::new(),
            hide_cam: true,
        }
    }
}

impl Quality {
    pub fn validated(mut self) -> AppResult<Self> {
        if self.max_size_bytes == Some(0) {
            return Err(AppError::bad_request("The largest size must be above zero, or empty for no limit."));
        }
        let mut languages: Vec<String> = Vec::new();
        for language in &self.languages {
            let code = language.trim().to_ascii_lowercase();
            let valid = !code.is_empty() && code.len() <= 12 && code.chars().all(|letter| letter.is_ascii_alphanumeric() || letter == '-');
            if !valid {
                return Err(AppError::bad_request(format!("\"{language}\" is not a language code.")));
            }
            if !languages.contains(&code) {
                languages.push(code);
            }
        }
        if languages.len() > MAX_LANGUAGES {
            return Err(AppError::bad_request(format!("Pick at most {MAX_LANGUAGES} languages.")));
        }
        self.languages = languages;
        Ok(self)
    }

    pub fn without_filters(&self) -> Self {
        Self {
            max_size_bytes: None,
            hide_cam: false,
            ..self.clone()
        }
    }
}
