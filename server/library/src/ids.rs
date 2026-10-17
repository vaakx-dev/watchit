use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use watchit_catalog::is_title_id;
use watchit_core::AppError;

pub fn series_of(id: &str) -> &str {
    id.split(':').next().unwrap_or(id)
}

pub fn episode_position(id: &str) -> Option<(i64, i64)> {
    let mut parts = id.split(':').skip(1);
    Some((parts.next()?.parse().ok()?, parts.next()?.parse().ok()?))
}

pub fn title_id(id: String) -> Result<String, AppError> {
    if is_title_id(&id) { Ok(id) } else { Err(AppError::bad_request("Invalid title identifier.")) }
}

pub struct TitleId(pub String);

impl<S: Send + Sync> FromRequestParts<S> for TitleId {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, AppError> {
        let Path(id) = Path::<String>::from_request_parts(parts, state).await.map_err(|_| AppError::bad_request("Invalid title identifier."))?;
        title_id(id).map(TitleId)
    }
}
