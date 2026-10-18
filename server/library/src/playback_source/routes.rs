use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::{PlaybackPreference, SourcePatch};
use crate::Library;
use crate::ids::{TitleId, series_of};

pub async fn update(
    State(library): State<Library>,
    viewer: Viewer,
    TitleId(id): TitleId,
    JsonBody(patch): JsonBody<SourcePatch>,
) -> AppResult<Json<PlaybackPreference>> {
    library.title(&id).await?;
    let target = series_of(&id).to_owned();
    let source = patch.source;
    let saved = source.clone();
    library
        .db
        .run(move |conn| store::put(conn, viewer.profile, &id, saved.as_deref()))
        .await?;
    Ok(Json(PlaybackPreference { id: target, source }))
}
