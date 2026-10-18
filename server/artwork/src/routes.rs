use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde::Deserialize;
use watchit_core::{AppError, AppResult};

use crate::cache::Cached;
use crate::clock::now_ms;
use crate::key::ImageKey;
use crate::records;
use crate::service::{Artwork, ArtworkStatus};

const NO_IMAGE_CACHE: &str = "private, no-cache";

#[derive(Deserialize)]
struct ImageQuery {
    v: Option<String>,
}

pub fn router(artwork: Artwork) -> Router {
    Router::new().route("/api/images/{key}", get(image)).with_state(artwork)
}

pub fn status_router(artwork: Artwork) -> Router {
    Router::new().route("/api/artwork", get(status)).with_state(artwork)
}

async fn status(State(artwork): State<Artwork>) -> Json<ArtworkStatus> {
    Json(artwork.status())
}

fn cache_control(artwork: &Artwork, key: &ImageKey, cached: &Cached, version: Option<&str>) -> String {
    if cached.stale || version != Some(cached.fetched_at.to_string().as_str()) {
        return NO_IMAGE_CACHE.into();
    }
    let remaining = artwork.settings().lifetime_ms(key.jitter()) - (now_ms() - cached.fetched_at);
    let seconds = remaining / 1000;
    if seconds > 0 {
        format!("private, max-age={seconds}, immutable")
    } else {
        NO_IMAGE_CACHE.into()
    }
}

async fn image(State(artwork): State<Artwork>, Path(key): Path<String>, Query(query): Query<ImageQuery>, request: HeaderMap) -> AppResult<Response> {
    let key = ImageKey::parse(&key).ok_or_else(|| AppError::not_found("API route not found."))?;
    let lookup = key.clone();
    if artwork.db().run(move |conn| records::get(conn, &lookup)).await?.is_none() {
        return Err(AppError::not_found("Image not found."));
    }
    let cached = artwork.image(&key).await?;
    let etag = format!("\"{key}:{}:{}\"", cached.fetched_at, cached.bytes);
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/webp"));
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    let control = cache_control(&artwork, &key, &cached, query.v.as_deref());
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_str(&control).map_err(AppError::internal)?);
    headers.insert(header::ETAG, HeaderValue::from_str(&etag).map_err(AppError::internal)?);
    if cached.stale {
        headers.insert("x-watchit-stale", HeaderValue::from_static("true"));
    }
    if request
        .get(header::IF_NONE_MATCH)
        .is_some_and(|value| value.as_bytes() == etag.as_bytes())
    {
        return Ok((StatusCode::NOT_MODIFIED, headers).into_response());
    }
    let body = tokio::fs::read(&cached.path)
        .await
        .map_err(|_| AppError::new(StatusCode::SERVICE_UNAVAILABLE, "Cached image is unavailable."))?;
    Ok((headers, body).into_response())
}
