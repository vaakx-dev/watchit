use axum::routing::get;
use axum::{Json, Router};
use ts_rs::TS;

#[derive(serde::Serialize, TS)]
#[ts(export_to = "about/")]
pub struct About {
    version: &'static str,
}

async fn show() -> Json<About> {
    Json(About {
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn router() -> Router {
    Router::new().route("/api/about", get(show))
}

pub fn export_types(config: &ts_rs::Config) -> Result<(), ts_rs::ExportError> {
    About::export_all(config)
}
