use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::http::{HeaderValue, header};
use axum::middleware;
use axum::routing::any;
use tower_http::set_header::SetResponseHeaderLayer;
use watchit_core::{AppError, AppResult, Context};
use watchit_playback::Playback;
use watchit_profiles::Profiles;
use watchit_remote::Remote;
use watchit_torrents::{NoTitles, Torrents};

use crate::auth::{Auth, authenticate, require_viewer};
use crate::origin::reject_cross_origin_writes;
use crate::torrent_sources::TorrentSources;

async fn not_found() -> AppError {
    AppError::not_found("API route not found.")
}

pub fn router(context: &Context, listen: SocketAddr) -> AppResult<Router> {
    let profiles = Profiles::open(context)?;
    let auth = Auth { profiles: profiles.clone(), tokens: context.tokens.clone() };
    let torrents = Torrents::open(context, Arc::new(NoTitles))?;
    let sources = Arc::new(TorrentSources::new(torrents.clone(), listen));
    let signed_in = Router::new()
        .merge(watchit_torrents::router(torrents))
        .merge(watchit_playback::router(Playback::open(context, sources)?))
        .merge(watchit_remote::router(Remote::new(listen)))
        .layer(middleware::from_fn(require_viewer));
    let router = Router::new()
        .merge(watchit_profiles::router(profiles))
        .merge(signed_in)
        .route("/api", any(not_found))
        .route("/api/{*path}", any(not_found))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL, HeaderValue::from_static("no-store")))
        .layer(middleware::from_fn_with_state(auth, authenticate))
        .layer(middleware::from_fn(reject_cross_origin_writes));
    Ok(router)
}
