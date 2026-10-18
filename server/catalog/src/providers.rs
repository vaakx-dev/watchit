use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

use serde::Deserialize;
use watchit_core::{AppError, AppResult};

use crate::model::ProviderIds;

#[derive(Deserialize)]
struct Mapping {
    one_anime: Option<serde_json::Value>,
}

pub(crate) struct Providers {
    file: PathBuf,
    loaded: Mutex<Option<(SystemTime, HashMap<String, Mapping>)>>,
}

impl Providers {
    pub fn new(file: PathBuf) -> Self {
        Self {
            file,
            loaded: Mutex::new(None),
        }
    }

    pub fn ids(&self, id: &str) -> AppResult<Option<ProviderIds>> {
        let modified = match std::fs::metadata(&self.file) {
            Ok(meta) => meta.modified().map_err(AppError::internal)?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(AppError::internal(error)),
        };
        let mut loaded = self.loaded.lock().unwrap();
        if loaded.as_ref().is_none_or(|(at, _)| *at != modified) {
            let text = std::fs::read_to_string(&self.file).map_err(AppError::internal)?;
            let mappings = serde_json::from_str(&text).map_err(|error| AppError::internal(format!("Invalid providers.json: {error}")))?;
            *loaded = Some((modified, mappings));
        }
        let Some(value) = loaded
            .as_ref()
            .and_then(|(_, mappings)| mappings.get(id))
            .and_then(|mapping| mapping.one_anime.as_ref())
        else {
            return Ok(None);
        };
        match value.as_str() {
            Some(one_anime) if one_anime.len() == 32 && one_anime.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f')) => {
                Ok(Some(ProviderIds {
                    one_anime: one_anime.to_owned(),
                }))
            }
            _ => Err(AppError::internal(format!("Invalid 1Anime mapping for {id} in providers.json."))),
        }
    }
}
