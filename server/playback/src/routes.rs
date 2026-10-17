use std::path::Path;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path as UrlPath, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use tokio_util::io::ReaderStream;
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use crate::api::{CreateSession, PlaybackSession};
use crate::service::Playback;

pub fn router(playback: Arc<Playback>) -> Router {
    Router::new()
        .route("/api/playback/sessions", post(create))
        .route("/api/playback/sessions/{id}", delete(remove))
        .route("/api/playback/sessions/{id}/hls/main.m3u8", get(playlist))
        .route("/api/playback/sessions/{id}/hls/{segment}", get(segment))
        .route("/api/playback/sessions/{id}/subtitles/{track}", get(subtitle))
        .with_state(playback)
}

async fn create(State(playback): State<Arc<Playback>>, viewer: Viewer, JsonBody(request): JsonBody<CreateSession>) -> AppResult<Json<PlaybackSession>> {
    playback.create(&viewer, request).await.map(Json)
}

async fn remove(State(playback): State<Arc<Playback>>, viewer: Viewer, UrlPath(id): UrlPath<String>) -> AppResult<StatusCode> {
    playback.delete(&viewer, &id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn playlist(State(playback): State<Arc<Playback>>, UrlPath(id): UrlPath<String>) -> AppResult<Response> {
    let body = playback.playlist(&id)?;
    Ok(([(header::CONTENT_TYPE, "application/vnd.apple.mpegurl"), (header::CACHE_CONTROL, "no-cache")], body).into_response())
}

async fn segment(State(playback): State<Arc<Playback>>, UrlPath((id, segment)): UrlPath<(String, String)>) -> AppResult<Response> {
    let index = numbered(&segment, ".ts")?;
    let path = playback.segment(&id, index as usize).await?;
    file_response(&path, "video/mp2t").await
}

async fn subtitle(State(playback): State<Arc<Playback>>, UrlPath((id, track)): UrlPath<(String, String)>) -> AppResult<Response> {
    let stream = numbered(&track, ".vtt")?;
    let path = playback.subtitle(&id, stream).await?;
    file_response(&path, "text/vtt; charset=utf-8").await
}

fn numbered(name: &str, extension: &str) -> AppResult<u32> {
    name.strip_suffix(extension).and_then(|number| number.parse().ok()).ok_or_else(|| AppError::not_found("Not found."))
}

async fn file_response(path: &Path, content_type: &'static str) -> AppResult<Response> {
    let file = tokio::fs::File::open(path).await.map_err(AppError::internal)?;
    let length = file.metadata().await.map_err(AppError::internal)?.len();
    let headers = [(header::CONTENT_TYPE, content_type.to_owned()), (header::CONTENT_LENGTH, length.to_string()), (header::CACHE_CONTROL, "no-cache".to_owned())];
    Ok((headers, Body::from_stream(ReaderStream::new(file))).into_response())
}
