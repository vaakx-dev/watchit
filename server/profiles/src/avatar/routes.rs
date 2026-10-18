use axum::Json;
use axum::body::{Body, to_bytes};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use http_body_util::LengthLimitError;
use rusqlite::Connection;
use serde::Deserialize;
use watchit_core::{AppError, AppResult, Viewer};

use super::image::avatar_webp;
use super::store;
use crate::Profiles;
use crate::profile::{self, Profile};
use crate::target::{ProfileId, require_self_or_admin};

const MAX_BYTES: usize = 5 * 1024 * 1024;
const VERSIONED: &str = "public, max-age=31536000, immutable";

#[derive(Deserialize)]
pub struct Version {
    v: Option<String>,
}

fn unreadable_upload(error: axum::Error) -> AppError {
    if error.into_inner().is::<LengthLimitError>() {
        AppError::new(StatusCode::PAYLOAD_TOO_LARGE, "Request body is too large.")
    } else {
        AppError::bad_request("The upload did not arrive in full.")
    }
}

fn editable(conn: &Connection, viewer: Viewer, id: i64) -> AppResult<()> {
    profile::existing(conn, id)?;
    require_self_or_admin(viewer, id)
}

async fn edit(
    profiles: &Profiles,
    viewer: Viewer,
    id: i64,
    change: impl FnOnce(&Connection) -> AppResult<()> + Send + 'static,
) -> AppResult<Json<Profile>> {
    let profile = profiles
        .db
        .run(move |conn| {
            editable(conn, viewer, id)?;
            change(conn)?;
            profile::existing(conn, id)
        })
        .await?;
    Ok(Json(profile))
}

pub async fn show(
    State(profiles): State<Profiles>,
    ProfileId(id): ProfileId,
    Query(version): Query<Version>,
    headers: HeaderMap,
) -> AppResult<Response> {
    let avatar = profiles
        .db
        .run(move |conn| {
            profile::existing(conn, id)?;
            store::get(conn, id)
        })
        .await?
        .ok_or_else(|| AppError::not_found("This profile has no photo."))?;
    let etag = format!("\"{}\"", avatar.updated_at);
    let versioned = version.v == Some(avatar.updated_at.to_string());
    let fresh = headers
        .get(header::IF_NONE_MATCH)
        .is_some_and(|value| value.as_bytes() == etag.as_bytes());
    let (status, body) = if fresh {
        (StatusCode::NOT_MODIFIED, Body::empty())
    } else {
        (StatusCode::OK, Body::from(avatar.image))
    };
    let headers = [
        (header::CONTENT_TYPE, "image/webp".to_owned()),
        (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_owned()),
        (header::CACHE_CONTROL, if versioned { VERSIONED } else { "no-cache" }.to_owned()),
        (header::ETAG, etag),
    ];
    Ok((status, headers, body).into_response())
}

pub async fn upload(
    State(profiles): State<Profiles>,
    viewer: Viewer,
    ProfileId(id): ProfileId,
    headers: HeaderMap,
    body: Body,
) -> AppResult<Json<Profile>> {
    profiles.db.run(move |conn| editable(conn, viewer, id)).await?;
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !content_type.starts_with("image/") {
        return Err(AppError::new(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Upload an image file."));
    }
    let upload = to_bytes(body, MAX_BYTES).await.map_err(unreadable_upload)?;
    let image = tokio::task::spawn_blocking(move || avatar_webp(&upload))
        .await
        .map_err(AppError::internal)??;
    edit(&profiles, viewer, id, move |conn| store::put(conn, id, &image)).await
}

pub async fn remove(State(profiles): State<Profiles>, viewer: Viewer, ProfileId(id): ProfileId) -> AppResult<Json<Profile>> {
    edit(&profiles, viewer, id, move |conn| store::delete(conn, id)).await
}

pub async fn shuffle(State(profiles): State<Profiles>, viewer: Viewer, ProfileId(id): ProfileId) -> AppResult<Json<Profile>> {
    edit(&profiles, viewer, id, move |conn| store::shuffle(conn, id)).await
}
