use axum::Json;
use axum::extract::Query;
use serde::Deserialize;
use watchit_core::{AppResult, Viewer};

use super::browse::{FolderListing, browse};

#[derive(Deserialize)]
pub struct FolderQuery {
    path: Option<String>,
}

pub async fn folders(viewer: Viewer, Query(query): Query<FolderQuery>) -> AppResult<Json<FolderListing>> {
    viewer.require_admin()?;
    let path = query.path;
    let listing = tokio::task::spawn_blocking(move || browse(path.as_deref())).await.map_err(watchit_core::AppError::internal)??;
    Ok(Json(listing))
}
