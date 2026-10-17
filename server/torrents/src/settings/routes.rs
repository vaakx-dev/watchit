use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody};

use super::Settings;
use crate::service::Torrents;

pub async fn show(State(torrents): State<Torrents>) -> AppResult<Json<Settings>> {
    Ok(Json(torrents.transfers().await?.settings()))
}

pub async fn update(State(torrents): State<Torrents>, JsonBody(settings): JsonBody<Settings>) -> AppResult<Json<Settings>> {
    torrents.transfers().await?.update_settings(settings).await.map(Json)
}
