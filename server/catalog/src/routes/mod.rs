mod catalog;
mod params;
mod titles;

use axum::Router;
use axum::routing::get;

use crate::service::Catalog;

pub fn router(catalog: Catalog) -> Router {
    Router::new()
        .route("/api/catalog", get(catalog::list))
        .route("/api/trending", get(catalog::trending_list))
        .route("/api/imports", get(catalog::imports))
        .route("/api/cache", get(catalog::cache).patch(catalog::update_cache))
        .route("/api/titles/{id}", get(titles::title))
        .route("/api/titles/{id}/episodes", get(titles::episode_list))
        .route("/api/titles/{id}/navigation", get(titles::navigation))
        .route("/api/titles/{id}/related", get(titles::related))
        .with_state(catalog)
}
