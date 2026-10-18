use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::{LibrarySnapshot, PersonalPatch};
use crate::Library;
use crate::ids::TitleId;

pub async fn snapshot(State(library): State<Library>, viewer: Viewer) -> AppResult<Json<LibrarySnapshot>> {
    let requester = library.clone();
    library.db.run(move |conn| requester.request_missing(conn, viewer.profile)).await?;
    library.snapshot(viewer.profile).await.map(Json)
}

pub async fn update(
    State(library): State<Library>,
    viewer: Viewer,
    TitleId(id): TitleId,
    JsonBody(patch): JsonBody<PersonalPatch>,
) -> AppResult<Json<LibrarySnapshot>> {
    let title = library.title(&id).await?;
    library
        .db
        .run(move |conn| store::apply(conn, viewer.profile, &id, &title, &patch))
        .await?;
    library.snapshot(viewer.profile).await.map(Json)
}
