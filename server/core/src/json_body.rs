use axum::body::Bytes;
use axum::extract::{FromRequest, Request};
use serde::de::DeserializeOwned;

use crate::AppError;

pub struct JsonBody<T>(pub T);

impl<T: DeserializeOwned, S: Send + Sync> FromRequest<S> for JsonBody<T> {
    type Rejection = AppError;

    async fn from_request(request: Request, state: &S) -> Result<Self, AppError> {
        let bytes = Bytes::from_request(request, state).await.map_err(|rejection| AppError::new(rejection.status(), rejection.body_text()))?;
        let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| AppError::bad_request("Request body must be JSON."))?;
        serde_json::from_value(value).map(JsonBody).map_err(|error| AppError::bad_request(error.to_string()))
    }
}
