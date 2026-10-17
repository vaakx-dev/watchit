mod avatar;
mod clock;
mod pin;
mod profile;
mod session;
mod target;

use axum::Router;
use axum::routing::{get, patch, post};
use ts_rs::{Config, ExportError, TS};
use watchit_core::{AppResult, Context, Db, Viewer};

use pin::PinChange;
use profile::{Profile, ProfilePatch};
use session::{ProfileSession, SessionState};

#[derive(Clone)]
pub struct Profiles {
    db: Db,
}

impl Profiles {
    pub fn open(context: &Context) -> AppResult<Self> {
        let tables = [profile::TABLE, pin::TABLES, session::TABLE, avatar::TABLE].concat();
        context.db.run_blocking(|conn| Ok(conn.execute_batch(&tables)?))?;
        Ok(Self { db: context.db.clone() })
    }

    pub async fn session_viewer(&self, token: String) -> AppResult<Option<Viewer>> {
        self.db
            .run(move |conn| match session::profile(conn, &token)? {
                Some(id) => profile::viewer(conn, id),
                None => Ok(None),
            })
            .await
    }

    pub async fn viewer(&self, profile: i64) -> AppResult<Option<Viewer>> {
        self.db.run(move |conn| profile::viewer(conn, profile)).await
    }
}

pub fn router(profiles: Profiles) -> Router {
    Router::new()
        .route("/api/session", get(session::current).delete(session::sign_out))
        .route("/api/profiles", get(profile::list).post(profile::create))
        .route("/api/profiles/{id}", patch(profile::update).delete(profile::delete))
        .route("/api/profiles/{id}/session", post(session::sign_in))
        .route("/api/profiles/{id}/pin", patch(pin::change))
        .route("/api/profiles/{id}/avatar", get(avatar::show).put(avatar::upload).delete(avatar::remove))
        .route("/api/profiles/{id}/avatar/shuffle", post(avatar::shuffle))
        .with_state(profiles)
}

pub fn export_types(config: &Config) -> Result<(), ExportError> {
    Profile::export_all(config)?;
    ProfilePatch::export_all(config)?;
    PinChange::export_all(config)?;
    ProfileSession::export_all(config)?;
    SessionState::export_all(config)
}
