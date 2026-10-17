use axum::Json;
use axum::extract::State;
use watchit_core::{AppResult, JsonBody, Viewer};

use crate::tailscale::{self, SharingChange};
use crate::{Remote, RemoteStatus};

pub async fn status(State(remote): State<Remote>, viewer: Viewer) -> Json<RemoteStatus> {
    Json(remote.status(viewer.admin).await)
}

pub async fn share(State(remote): State<Remote>, viewer: Viewer, JsonBody(change): JsonBody<SharingChange>) -> AppResult<Json<RemoteStatus>> {
    viewer.require_admin()?;
    tailscale::set_sharing(remote.listen, change.enabled).await?;
    Ok(Json(remote.status(viewer.admin).await))
}
