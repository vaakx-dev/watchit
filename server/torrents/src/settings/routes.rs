use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::Settings;
use crate::locations::require_admin_for_folders;
use crate::service::Torrents;

pub async fn show(State(torrents): State<Torrents>) -> AppResult<Json<Settings>> {
    Ok(Json(torrents.transfers().await?.settings()))
}

pub async fn update(State(torrents): State<Torrents>, viewer: Viewer, JsonBody(settings): JsonBody<Settings>) -> AppResult<Json<Settings>> {
    let transfers = torrents.transfers().await?;
    require_admin_for_folders(&viewer, &transfers.settings(), &settings)?;
    transfers.update_settings(settings).await.map(Json)
}
