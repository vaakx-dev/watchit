mod attribution;
mod cinemeta;
mod clock;
mod genres;
mod ids;
mod model;
mod personal;
mod providers;
mod related;
mod routes;
mod service;
mod settings;
mod store;
mod sync;

pub use genres::GenreOption;
pub use ids::{is_imdb_id, is_title_id};
pub use model::*;
pub use personal::{HIDE_STATUSES, Personal, SeriesProgress, TitleExtras};
pub use routes::router;
pub use service::Catalog;
pub use store::browse::{BrowseQuery, IdFilter};

pub fn export_types(config: &ts_rs::Config) -> Result<(), ts_rs::ExportError> {
    use ts_rs::TS;
    CatalogResponse::export_all(config)?;
    TrendingResponse::export_all(config)?;
    EpisodesResponse::export_all(config)?;
    NavigationResponse::export_all(config)?;
    TitleResult::export_all(config)?;
    RelatedTitles::export_all(config)?;
    ImportStatus::export_all(config)?;
    CacheStatus::export_all(config)
}
