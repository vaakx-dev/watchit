use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::{RankingMove, Rankings};
use crate::Library;
use crate::ids::{TitleId, title_id};
use crate::query::Params;

pub async fn show(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<Rankings>> {
    let kind = params.kind()?;
    let catalog = library.catalog.clone();
    library.db.run(move |conn| store::rankings(conn, &catalog, viewer.profile, kind)).await.map(Json)
}

pub async fn place(
    State(library): State<Library>,
    viewer: Viewer,
    params: Params,
    TitleId(id): TitleId,
    JsonBody(body): JsonBody<RankingMove>,
) -> AppResult<Json<Rankings>> {
    let kind = params.kind()?;
    let before = body.before.map(title_id).transpose()?;
    let catalog = library.catalog.clone();
    let rankings = library
        .db
        .run(move |conn| {
            store::place(conn, viewer.profile, &id, before.as_deref())?;
            store::rankings(conn, &catalog, viewer.profile, kind)
        })
        .await?;
    Ok(Json(rankings))
}
