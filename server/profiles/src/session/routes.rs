use std::net::SocketAddr;

use axum::Json;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use watchit_core::{AppResult, JsonBody, SESSION_HEADER, Viewer};

use super::store;
use super::types::{ProfileSession, SessionState};
use crate::Profiles;
use crate::pin::{self, SignIn};
use crate::profile;
use crate::target::ProfileId;

pub fn token(headers: &HeaderMap) -> Option<String> {
    let token = headers.get(SESSION_HEADER)?.to_str().ok()?;
    (!token.is_empty()).then(|| token.to_owned())
}

pub async fn current(State(profiles): State<Profiles>, viewer: Option<Viewer>) -> AppResult<Json<SessionState>> {
    let Some(viewer) = viewer else { return Ok(Json(SessionState { profile: None })) };
    let profile = profiles.db.run(move |conn| profile::get(conn, viewer.profile)).await?;
    Ok(Json(SessionState { profile }))
}

pub async fn sign_out(State(profiles): State<Profiles>, headers: HeaderMap) -> AppResult<Json<SessionState>> {
    if let Some(token) = token(&headers) {
        profiles.db.run(move |conn| store::delete(conn, &token)).await?;
    }
    Ok(Json(SessionState { profile: None }))
}

pub async fn sign_in(
    State(profiles): State<Profiles>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    ProfileId(id): ProfileId,
    JsonBody(body): JsonBody<SignIn>,
) -> AppResult<(StatusCode, Json<ProfileSession>)> {
    let previous = token(&headers);
    let session = profiles
        .db
        .run(move |conn| {
            let profile = profile::existing(conn, id)?;
            pin::check(conn, id, body.pin.as_ref(), &client.ip().to_string())?;
            if let Some(previous) = previous {
                store::delete(conn, &previous)?;
            }
            Ok(ProfileSession { token: store::create(conn, id)?, profile })
        })
        .await?;
    Ok((StatusCode::CREATED, Json(session)))
}
