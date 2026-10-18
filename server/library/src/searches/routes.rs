use axum::Json;
use axum::extract::{Path, State};
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::{NewSearch, RecentSearches};
use crate::Library;

async fn respond(library: &Library, profile: i64) -> AppResult<Json<RecentSearches>> {
    let searches = library.db.run(move |conn| store::list(conn, profile)).await?;
    Ok(Json(RecentSearches { searches }))
}

pub async fn list(State(library): State<Library>, viewer: Viewer) -> AppResult<Json<RecentSearches>> {
    respond(&library, viewer.profile).await
}

pub async fn remember(State(library): State<Library>, viewer: Viewer, JsonBody(search): JsonBody<NewSearch>) -> AppResult<Json<RecentSearches>> {
    library.db.run(move |conn| store::remember(conn, viewer.profile, &search.query)).await?;
    respond(&library, viewer.profile).await
}

pub async fn forget(State(library): State<Library>, viewer: Viewer, Path(query): Path<String>) -> AppResult<Json<RecentSearches>> {
    library.db.run(move |conn| store::forget(conn, viewer.profile, &query)).await?;
    respond(&library, viewer.profile).await
}

pub async fn clear(State(library): State<Library>, viewer: Viewer) -> AppResult<Json<RecentSearches>> {
    library.db.run(move |conn| store::clear(conn, viewer.profile)).await?;
    respond(&library, viewer.profile).await
}
