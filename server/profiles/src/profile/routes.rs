use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use super::store;
use super::types::{DeleteProfile, NewProfile, Profile, ProfilePatch};
use crate::Profiles;
use crate::target::{ProfileId, require_self_or_admin};

pub async fn list(State(profiles): State<Profiles>) -> AppResult<Json<Vec<Profile>>> {
    profiles.db.run(|conn| store::list(conn)).await.map(Json)
}

pub async fn create(
    State(profiles): State<Profiles>,
    viewer: Option<Viewer>,
    JsonBody(body): JsonBody<NewProfile>,
) -> AppResult<(StatusCode, Json<Profile>)> {
    let profile = profiles
        .db
        .run(move |conn| {
            if !store::list(conn)?.is_empty() {
                viewer.ok_or_else(AppError::signed_out)?.require_admin()?;
            }
            store::create(conn, &body.name)
        })
        .await?;
    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn update(
    State(profiles): State<Profiles>,
    viewer: Viewer,
    ProfileId(id): ProfileId,
    JsonBody(patch): JsonBody<ProfilePatch>,
) -> AppResult<Json<Profile>> {
    if patch.name.is_none() && patch.is_admin.is_none() {
        return Err(AppError::bad_request("Body may contain only a name string and an is_admin boolean."));
    }
    let profile = profiles
        .db
        .run(move |conn| {
            store::existing(conn, id)?;
            match patch.is_admin {
                Some(_) => viewer.require_admin()?,
                None => require_self_or_admin(viewer, id)?,
            }
            store::update(conn, id, &patch)
        })
        .await?;
    Ok(Json(profile))
}

pub async fn delete(
    State(profiles): State<Profiles>,
    viewer: Viewer,
    ProfileId(id): ProfileId,
    JsonBody(body): JsonBody<DeleteProfile>,
) -> AppResult<Json<Vec<Profile>>> {
    viewer.require_admin()?;
    profiles.db.run(move |conn| store::delete(conn, id, &body.confirm)).await.map(Json)
}
