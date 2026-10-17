use axum::http::StatusCode;
use watchit_core::AppError;

use crate::clock::now_ms;

#[derive(Clone, Debug)]
pub(crate) enum Cause {
    Origin { status: u16, retry_at: i64 },
    Redirect,
    Rejected,
    Unavailable,
}

#[derive(Clone, Debug)]
pub struct ImageFailure {
    pub(crate) message: String,
    pub(crate) cause: Cause,
}

impl ImageFailure {
    pub(crate) fn origin(status: u16, retry_at: i64) -> Self {
        Self { message: format!("Image origin returned {status}"), cause: Cause::Origin { status, retry_at } }
    }

    pub(crate) fn redirect(status: u16, detail: &str) -> Self {
        Self { message: format!("Image origin returned {status}: {detail}"), cause: Cause::Redirect }
    }

    pub(crate) fn rejected(message: impl Into<String>) -> Self {
        Self { message: message.into(), cause: Cause::Rejected }
    }

    pub(crate) fn unavailable(message: impl Into<String>) -> Self {
        Self { message: message.into(), cause: Cause::Unavailable }
    }

    pub(crate) fn retry_at(&self) -> i64 {
        match self.cause {
            Cause::Origin { retry_at, .. } => retry_at,
            _ => 0,
        }
    }

    pub(crate) fn permanent(&self) -> bool {
        match self.cause {
            Cause::Origin { status, .. } => (400..500).contains(&status) && status != 408 && status != 429,
            Cause::Redirect => true,
            Cause::Rejected | Cause::Unavailable => false,
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl From<ImageFailure> for AppError {
    fn from(failure: ImageFailure) -> Self {
        let status = match failure.cause {
            Cause::Origin { status, .. } => StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY),
            Cause::Redirect | Cause::Unavailable => StatusCode::BAD_GATEWAY,
            Cause::Rejected => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let retry_at = failure.retry_at();
        let error = AppError::new(status, failure.message);
        let wait = retry_at - now_ms();
        if wait > 0 { error.retry_after((wait as u64).div_ceil(1000)) } else { error }
    }
}

impl From<AppError> for ImageFailure {
    fn from(error: AppError) -> Self {
        Self::rejected(error.message)
    }
}
