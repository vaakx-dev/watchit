use std::path::Path;

use axum::Router;
use axum::http::{HeaderValue, Response, header};
use tower::Layer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;

const HASHED: &str = "public, max-age=31536000, immutable";
const REVALIDATE: &str = "no-cache";

fn cache<B>(policy: &'static str) -> SetResponseHeaderLayer<impl Fn(&Response<B>) -> Option<HeaderValue> + Clone> {
    SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, move |response: &Response<B>| {
        response.status().is_success().then(|| HeaderValue::from_static(policy))
    })
}

pub fn router(web_dir: &Path) -> Router {
    let assets = ServeDir::new(web_dir.join("assets"));
    let pages = ServeDir::new(web_dir).fallback(ServeFile::new(web_dir.join("index.html")));
    Router::new().nest_service("/assets", cache(HASHED).layer(assets)).fallback_service(cache(REVALIDATE).layer(pages))
}
