use axum::http::{Extensions, HeaderMap, StatusCode, Version, header};
use tower_http::CompressionLevel;
use tower_http::compression::predicate::{Predicate, SizeAbove};
use tower_http::compression::CompressionLayer;

const TEXT_TYPES: [&str; 6] = ["application/json", "text/html", "text/css", "text/javascript", "image/svg+xml", "text/vtt"];

fn text_response(_: StatusCode, _: Version, headers: &HeaderMap, _: &Extensions) -> bool {
    let content_type = headers.get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or_default();
    TEXT_TYPES.iter().any(|text| content_type.starts_with(text))
}

pub fn layer() -> CompressionLayer<impl Predicate> {
    CompressionLayer::new().quality(CompressionLevel::Precise(4)).compress_when(SizeAbove::new(1024).and(text_response))
}
