use std::fmt;
use std::sync::LazyLock;

use regex::Regex;
use watchit_core::{AppError, AppResult};

static TITLE_ID: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(tt\d{7,12})(?::(\d{1,5}):(\d{1,5}))?$").expect("valid title id regex"));

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TitleId {
    Title(String),
    Episode { series: String, season: u32, episode: u32 },
}

impl TitleId {
    pub fn parse(value: &str) -> AppResult<Self> {
        let found = TITLE_ID.captures(value).ok_or_else(|| AppError::bad_request("Invalid title identifier."))?;
        let imdb = found[1].to_owned();
        Ok(match (found.get(2), found.get(3)) {
            (Some(season), Some(episode)) => Self::Episode {
                series: imdb,
                season: season.as_str().parse().map_err(|_| AppError::bad_request("Invalid season."))?,
                episode: episode.as_str().parse().map_err(|_| AppError::bad_request("Invalid episode."))?,
            },
            _ => Self::Title(imdb),
        })
    }

    pub fn episode(series: &str, season: u32, episode: u32) -> Self {
        Self::Episode { series: series.to_owned(), season, episode }
    }

    pub fn series(&self) -> Option<&str> {
        match self {
            Self::Episode { series, .. } => Some(series),
            Self::Title(_) => None,
        }
    }

    pub fn is_episode(&self) -> bool {
        matches!(self, Self::Episode { .. })
    }
}

impl fmt::Display for TitleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Title(id) => f.write_str(id),
            Self::Episode { series, season, episode } => write!(f, "{series}:{season}:{episode}"),
        }
    }
}
