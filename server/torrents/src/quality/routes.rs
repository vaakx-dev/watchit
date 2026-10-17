use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::Quality;
use crate::service::Torrents;

pub async fn show(State(torrents): State<Torrents>, viewer: Viewer) -> AppResult<Json<Quality>> {
    torrents.quality(viewer.profile).await.map(Json)
}

pub async fn update(State(torrents): State<Torrents>, viewer: Viewer, JsonBody(quality): JsonBody<Quality>) -> AppResult<Json<Quality>> {
    torrents.save_quality(viewer.profile, quality.validated()?).await.map(Json)
}
