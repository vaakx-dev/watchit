use std::convert::Infallible;

use axum::extract::{FromRequestParts, OptionalFromRequestParts};
use axum::http::request::Parts;

use crate::{AppError, AppResult};

pub const SESSION_HEADER: &str = "X-Watchit-Session";

#[derive(Clone, Copy, Debug)]
pub struct Viewer {
    pub profile: i64,
    pub admin: bool,
}

impl Viewer {
    pub fn require_admin(&self) -> AppResult<()> {
        if self.admin { Ok(()) } else { Err(AppError::forbidden("Only an admin can do that.")) }
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Viewer {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, AppError> {
        parts.extensions.get::<Viewer>().copied().ok_or_else(AppError::signed_out)
    }
}

impl<S: Send + Sync> OptionalFromRequestParts<S> for Viewer {
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Option<Self>, Infallible> {
        Ok(parts.extensions.get::<Viewer>().copied())
    }
}
