use std::fmt::Display;

use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::SESSION_HEADER;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
    pub retry_after: Option<u64>,
}

impl AppError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            retry_after: None,
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    pub fn signed_out() -> Self {
        Self::unauthorized(format!(
            "Sign in first: POST /api/profiles/:id/session, then send its token in the {SESSION_HEADER} header."
        ))
    }

    pub fn internal(cause: impl Display) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, cause.to_string())
    }

    pub fn retry_after(mut self, seconds: u64) -> Self {
        self.retry_after = Some(seconds);
        self
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::internal(error)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::internal(error)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(json!({ "error": self.message }))).into_response();
        if let Some(seconds) = self.retry_after {
            response.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(seconds));
        }
        response
    }
}
