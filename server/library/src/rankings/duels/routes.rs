use axum::Json;
use axum::extract::State;
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use super::board::{board, ranking};
use super::store;
use super::types::{DuelBoard, DuelPair, DuelRanking, DuelResult};
use crate::Library;
use crate::ids::title_id;
use crate::query::Params;

pub async fn next(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<DuelBoard>> {
    let kind = params.kind()?;
    let catalog = library.catalog.clone();
    library
        .db
        .run(move |conn| board(conn, &catalog, viewer.profile, kind, None))
        .await
        .map(Json)
}

pub async fn result(
    State(library): State<Library>,
    viewer: Viewer,
    params: Params,
    JsonBody(body): JsonBody<DuelResult>,
) -> AppResult<Json<DuelBoard>> {
    let kind = params.kind()?;
    let (first, second) = (title_id(body.first)?, title_id(body.second)?);
    let (winner, other, tie) = match body.winner {
        None => (first, second, true),
        Some(winner) if winner == first => (first, second, false),
        Some(winner) if winner == second => (second, first, false),
        Some(_) => return Err(AppError::bad_request("The winner must be one of the two titles.")),
    };
    let catalog = library.catalog.clone();
    library
        .db
        .run(move |conn| {
            store::record(conn, viewer.profile, &winner, &other, tie)?;
            board(conn, &catalog, viewer.profile, kind, None)
        })
        .await
        .map(Json)
}

pub async fn skip(State(library): State<Library>, viewer: Viewer, params: Params, JsonBody(body): JsonBody<DuelPair>) -> AppResult<Json<DuelBoard>> {
    let kind = params.kind()?;
    let (first, second) = (title_id(body.first)?, title_id(body.second)?);
    let catalog = library.catalog.clone();
    library
        .db
        .run(move |conn| {
            store::skip(conn, viewer.profile, &first, &second)?;
            board(conn, &catalog, viewer.profile, kind, None)
        })
        .await
        .map(Json)
}

pub async fn undo(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<DuelBoard>> {
    let kind = params.kind()?;
    let catalog = library.catalog.clone();
    library
        .db
        .run(move |conn| {
            let replay = store::undo(conn, viewer.profile)?;
            board(conn, &catalog, viewer.profile, kind, replay)
        })
        .await
        .map(Json)
}

pub async fn ranked(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<DuelRanking>> {
    let kind = params.kind()?;
    let catalog = library.catalog.clone();
    library.db.run(move |conn| ranking(conn, &catalog, viewer.profile, kind)).await.map(Json)
}
