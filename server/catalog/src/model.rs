use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_artwork::ArtworkStatus;

use crate::genres::GenreOption;
use crate::personal::{SavedPosition, SeriesProgress};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export_to = "catalog/")]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Movie,
    Series,
    Episode,
}

impl MediaKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Movie => "movie",
            Self::Series => "series",
            Self::Episode => "episode",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "movie" => Some(Self::Movie),
            "series" => Some(Self::Series),
            "episode" => Some(Self::Episode),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export_to = "catalog/")]
#[serde(rename_all = "lowercase")]
pub enum CatalogKind {
    All,
    Movie,
    Series,
    Anime,
}

impl CatalogKind {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "all" => Some(Self::All),
            "movie" => Some(Self::Movie),
            "series" => Some(Self::Series),
            "anime" => Some(Self::Anime),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Movie => "movie",
            Self::Series => "series",
            Self::Anime => "anime",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export_to = "catalog/")]
#[serde(rename_all = "snake_case")]
pub enum CatalogSort {
    Relevance,
    Newest,
    Title,
    Trending,
    TopRated,
}

impl CatalogSort {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "relevance" => Some(Self::Relevance),
            "newest" => Some(Self::Newest),
            "title" => Some(Self::Title),
            "trending" => Some(Self::Trending),
            "top_rated" => Some(Self::TopRated),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct CatalogEntry {
    pub id: String,
    pub title: String,
    pub year: Option<i64>,
    pub artwork: String,
    pub genres: Vec<String>,
    pub kind: MediaKind,
    pub anime: bool,
    pub imdb_rating: Option<f64>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct EpisodeEntry {
    #[serde(flatten)]
    pub entry: CatalogEntry,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub synopsis: String,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct ImageCredit {
    pub source: &'static str,
    pub role: &'static str,
    pub source_url: String,
    pub description_url: String,
    pub terms_url: &'static str,
    pub author: &'static str,
    pub license: &'static str,
    pub license_url: &'static str,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub retrieved_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export_to = "catalog/")]
pub struct SeriesRef {
    pub id: String,
    pub title: String,
    pub imdb_id: Option<String>,
    pub tmdb_id: Option<i64>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct Trailer {
    pub id: String,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct ProviderIds {
    pub one_anime: String,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct Title {
    #[serde(flatten)]
    pub entry: CatalogEntry,
    pub backdrop: String,
    pub minutes: Option<i64>,
    pub synopsis: String,
    pub director: String,
    pub cast: String,
    pub imdb_id: Option<String>,
    pub tmdb_id: Option<i64>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub series: Option<SeriesRef>,
    pub related: Vec<CatalogEntry>,
    pub images: Vec<ImageCredit>,
    pub source_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provider_ids: Option<ProviderIds>,
    pub popularity: Option<f64>,
    pub trailers: Vec<Trailer>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct Freshness {
    pub updated_at: String,
    pub stale: bool,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct ImportStatus {
    pub enabled: bool,
    pub pending: bool,
    pub running: bool,
    pub imported: i64,
    pub error: Option<String>,
    pub next_retry_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct CatalogPage {
    pub items: Vec<CatalogEntry>,
    pub page: u32,
    pub has_next: bool,
    pub total: u32,
    pub genres: Vec<GenreOption>,
    pub freshness: Freshness,
    pub artwork_status: ArtworkStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct TrendingEntry {
    #[serde(flatten)]
    pub entry: CatalogEntry,
    pub rank: i64,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct TrendingPage {
    pub items: Vec<TrendingEntry>,
    pub page: u32,
    pub has_next: bool,
    pub day: Option<String>,
    pub artwork_status: ArtworkStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct EpisodePage {
    pub items: Vec<EpisodeEntry>,
    pub page: u32,
    pub has_next: bool,
    pub freshness: Freshness,
    pub artwork_status: ArtworkStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct EpisodeNavigation {
    #[serde(flatten)]
    pub page: EpisodePage,
    pub season: i64,
    pub seasons: Vec<i64>,
    pub previous: Option<EpisodeEntry>,
    pub next: Option<EpisodeEntry>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct FranchiseEntry {
    #[serde(flatten)]
    pub entry: CatalogEntry,
    pub position: usize,
    pub current: bool,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct Franchise {
    pub name: Option<String>,
    pub items: Vec<FranchiseEntry>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct RelatedTitles {
    pub franchise: Option<Franchise>,
    pub similar: Vec<CatalogEntry>,
    pub pending: bool,
    pub artwork_status: ArtworkStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct CatalogResponse {
    #[serde(flatten)]
    pub page: CatalogPage,
    pub imports: ImportStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct TrendingResponse {
    #[serde(flatten)]
    pub page: TrendingPage,
    pub imports: ImportStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct EpisodesResponse {
    #[serde(flatten)]
    pub page: EpisodePage,
    pub imports: ImportStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct NavigationResponse {
    #[serde(flatten)]
    pub navigation: EpisodeNavigation,
    pub imports: ImportStatus,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct TitleResult {
    pub title: Title,
    pub freshness: Freshness,
    pub playback_source: Option<String>,
    pub progress: Option<SeriesProgress>,
    pub resume: Option<SavedPosition>,
    pub imports: ImportStatus,
    pub artwork_status: ArtworkStatus,
}

#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct CacheSettings {
    pub metadata_hours: f64,
    pub images_days: f64,
    pub max_stale_days: f64,
    pub image_limit_mb: f64,
}

#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct CacheStatus {
    pub settings: CacheSettings,
    pub image_bytes: i64,
    pub image_count: i64,
    pub metadata_count: i64,
}
