use std::fmt;

use sha2::{Digest, Sha256};

use crate::source::approved_url;
use watchit_core::AppResult;

#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ImageKey(String);

impl ImageKey {
    pub fn for_source(source_url: &str) -> AppResult<(Self, String)> {
        let url = approved_url(source_url)?;
        let key = hex::encode(Sha256::digest(url.as_bytes()));
        Ok((Self(key), url))
    }

    pub fn parse(value: &str) -> Option<Self> {
        let valid = value.len() == 64 && value.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
        valid.then(|| Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn path(&self) -> String {
        format!("/api/images/{}", self.0)
    }

    pub(crate) fn jitter(&self) -> f64 {
        let prefix = u32::from_str_radix(&self.0[..8], 16).unwrap_or(0);
        0.2 * f64::from(prefix) / f64::from(u32::MAX)
    }
}

impl fmt::Display for ImageKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}
