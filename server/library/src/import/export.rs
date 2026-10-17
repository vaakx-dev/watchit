use serde::Deserialize;

#[derive(Deserialize)]
pub struct Export {
    pub profiles: Vec<ExportProfile>,
}

#[derive(Deserialize)]
pub struct ExportProfile {
    pub name: String,
    pub is_admin: bool,
    pub created_at: String,
    pub old_id: i64,
    pub pin: Option<ExportPin>,
    pub avatar: ExportAvatar,
    pub titles: Vec<Marked>,
    pub episodes: Vec<Marked>,
    pub season_ratings: Vec<ExportSeason>,
    pub playback_sources: Vec<ExportSource>,
}

#[derive(Deserialize)]
pub struct ExportPin {
    pub salt_hex: String,
    pub hash_hex: String,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExportAvatar {
    Eyes { seed: i64 },
    Image { file: String, updated_at_ms: i64, eye_seed: i64 },
}

#[derive(Deserialize)]
pub struct Marked {
    pub id: String,
    pub series_id: Option<String>,
    pub rating: Option<f64>,
    pub status: Option<String>,
    pub favorite: bool,
    pub recommended: bool,
    pub saved: bool,
    pub last_opened_at: Option<String>,
    pub ranking_position: Option<i64>,
}

impl Marked {
    pub fn is_empty(&self) -> bool {
        self.rating.is_none() && self.status.is_none() && !self.favorite && !self.recommended && !self.saved && self.last_opened_at.is_none()
    }
}

#[derive(Deserialize)]
pub struct ExportSeason {
    pub series_id: String,
    pub season: i64,
    pub rating: f64,
}

#[derive(Deserialize)]
pub struct ExportSource {
    pub id: String,
    pub source: String,
}
