use std::net::SocketAddr;

use axum::Json;
use axum::extract::{ConnectInfo, State};
use axum::http::HeaderMap;
use watchit_core::{AppResult, JsonBody, Viewer};

use super::store;
use super::types::PinChange;
use crate::Profiles;
use crate::profile::{self, Profile};
use crate::session;
use crate::target::ProfileId;

pub async fn change(
    State(profiles): State<Profiles>,
    viewer: Viewer,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    ProfileId(id): ProfileId,
    JsonBody(change): JsonBody<PinChange>,
) -> AppResult<Json<Profile>> {
    let own_session = session::token(&headers);
    let profile = profiles
        .db
        .run(move |conn| {
            profile::existing(conn, id)?;
            let own = viewer.profile == id;
            if own {
                store::check(conn, id, change.current_pin.as_ref(), &client.ip().to_string())?;
            } else {
                viewer.require_admin()?;
            }
            store::set(conn, id, change.pin.as_ref())?;
            session::revoke(conn, id, own_session.as_deref().filter(|_| own))?;
            profile::existing(conn, id)
        })
        .await?;
    Ok(Json(profile))
}
