mod address;
mod qr;
mod routes;
mod status;
mod tailscale;

use std::net::SocketAddr;

use axum::Router;
use axum::routing::{get, put};
use ts_rs::{Config, ExportError, TS};

pub use status::{Address, AddressKind, RemoteStatus};
pub use tailscale::{Sharing, SharingChange, TailscaleState, TailscaleStatus};

#[derive(Clone, Copy)]
pub struct Remote {
    listen: SocketAddr,
}

impl Remote {
    pub fn new(listen: SocketAddr) -> Self {
        Self { listen }
    }
}

pub fn router(remote: Remote) -> Router {
    Router::new()
        .route("/api/remote", get(routes::status))
        .route("/api/remote/tailscale", put(routes::share))
        .with_state(remote)
}

pub fn export_types(config: &Config) -> Result<(), ExportError> {
    RemoteStatus::export_all(config)?;
    SharingChange::export_all(config)
}
