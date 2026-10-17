mod engine;
mod library;
mod media;
mod release;
mod search;
mod service;
mod settings;
mod title_id;
mod titles;
mod transfers;

use axum::Router;
use axum::routing::{get, patch, post};
use ts_rs::{Config, ExportError, TS};

pub use media::{MediaSource, raw_path};
pub use service::Torrents;
pub use titles::{NoTitles, Titles};

pub fn router(torrents: Torrents) -> Router {
    Router::new()
        .route("/api/torrents/search", get(search::routes::search))
        .route("/api/torrents/settings", get(settings::routes::show).patch(settings::routes::update))
        .route("/api/torrents/{info_hash}/{file_index}/raw", get(media::raw::raw))
        .route("/api/transfers", get(transfers::routes::list).post(transfers::routes::create))
        .route("/api/transfers/events", get(transfers::routes::events))
        .route("/api/transfers/season", post(transfers::routes::season))
        .route("/api/transfers/{id}", patch(transfers::routes::update).delete(transfers::routes::remove))
        .route("/api/titles/{title_id}/files", get(library::routes::files))
        .with_state(torrents)
}

pub fn export_types(config: &Config) -> Result<(), ExportError> {
    search::routes::SearchResponse::export_all(config)?;
    transfers::routes::TransferList::export_all(config)?;
    transfers::routes::NewTransfer::export_all(config)?;
    transfers::routes::SeasonDownload::export_all(config)?;
    transfers::routes::TransferPatch::export_all(config)?;
    settings::Settings::export_all(config)?;
    library::routes::LocalFiles::export_all(config)
}
