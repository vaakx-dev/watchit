use std::collections::HashMap;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use watchit_catalog::CatalogKind;
use watchit_core::{AppError, AppResult};

pub const PAGE_SIZE: usize = 24;
const LAST_PAGE: u32 = 100_000;

pub struct Params(HashMap<String, String>);

impl<S: Send + Sync> FromRequestParts<S> for Params {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, AppError> {
        let pairs = parts.uri.query().map(|query| form_urlencoded::parse(query.as_bytes()).into_owned().collect()).unwrap_or_default();
        Ok(Self(pairs))
    }
}

impl Params {
    pub fn choice<T>(&self, name: &str, fallback: &str, parse: impl Fn(&str) -> Option<T>, message: &str) -> AppResult<T> {
        parse(self.0.get(name).map_or(fallback, String::as_str)).ok_or_else(|| AppError::bad_request(message))
    }

    pub fn kind(&self) -> AppResult<CatalogKind> {
        self.choice("kind", "all", CatalogKind::parse, "Invalid catalog type.")
    }

    pub fn page(&self) -> AppResult<u32> {
        let value = self.0.get("page").map_or("1", String::as_str);
        match value.parse::<u32>() {
            Ok(page) if (1..=LAST_PAGE).contains(&page) && value.bytes().all(|byte| byte.is_ascii_digit()) && !value.starts_with('0') => Ok(page),
            _ => Err(AppError::bad_request("Invalid page number.")),
        }
    }
}

pub fn offset(page: u32) -> i64 {
    i64::from(page - 1) * PAGE_SIZE as i64
}

pub fn kind_condition(kind: CatalogKind) -> &'static str {
    match kind {
        CatalogKind::All => "1",
        CatalogKind::Movie => "kind = 'movie'",
        CatalogKind::Series => "kind = 'series'",
        CatalogKind::Anime => "anime = 1",
    }
}
