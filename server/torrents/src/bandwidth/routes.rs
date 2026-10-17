use axum::Json;
use axum::extract::State;
use serde::Deserialize;
use ts_rs::TS;
use watchit_core::{AppResult, JsonBody};

use super::SpeedStatus;
use crate::service::Torrents;

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct SpeedPatch {
    alternative: bool,
}

pub async fn update(State(torrents): State<Torrents>, JsonBody(body): JsonBody<SpeedPatch>) -> AppResult<Json<SpeedStatus>> {
    torrents.transfers().await?.set_alternative(body.alternative).await.map(Json)
}
