use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use watchit_core::{AppError, AppResult, Viewer};

pub struct ProfileId(pub i64);

fn parse(segment: &str) -> Option<i64> {
    if segment.len() > 15 || segment.starts_with('0') || !segment.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    segment.parse().ok()
}

impl<S: Send + Sync> FromRequestParts<S> for ProfileId {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, AppError> {
        let not_found = || AppError::not_found("Profile not found.");
        let Path(segment) = Path::<String>::from_request_parts(parts, state).await.map_err(|_| not_found())?;
        parse(&segment).map(ProfileId).ok_or_else(not_found)
    }
}

pub fn require_self_or_admin(viewer: Viewer, id: i64) -> AppResult<()> {
    if viewer.profile == id || viewer.admin {
        Ok(())
    } else {
        Err(AppError::forbidden("You can only change your own profile."))
    }
}
