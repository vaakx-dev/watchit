use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::RankingChoice;
use crate::Library;

pub async fn show(State(library): State<Library>, viewer: Viewer) -> AppResult<Json<RankingChoice>> {
    let system = library.db.run(move |conn| store::load(conn, viewer.profile)).await?;
    Ok(Json(RankingChoice { system }))
}

pub async fn choose(State(library): State<Library>, viewer: Viewer, JsonBody(choice): JsonBody<RankingChoice>) -> AppResult<Json<RankingChoice>> {
    library.db.run(move |conn| store::save(conn, viewer.profile, choice.system)).await?;
    Ok(Json(choice))
}
