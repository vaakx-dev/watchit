use axum::extract::Request;
use axum::http::{HeaderMap, Method, Uri, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use watchit_core::AppError;

fn origin_host(headers: &HeaderMap) -> Option<String> {
    let origin: Uri = headers.get(header::ORIGIN)?.to_str().ok()?.parse().ok()?;
    Some(origin.authority()?.as_str().to_ascii_lowercase())
}

fn request_host(request: &Request) -> Option<String> {
    let host = match request.headers().get(header::HOST) {
        Some(host) => host.to_str().ok()?,
        None => request.uri().authority()?.as_str(),
    };
    Some(host.to_ascii_lowercase())
}

fn same_origin(request: &Request) -> bool {
    if !request.headers().contains_key(header::ORIGIN) {
        return true;
    }
    origin_host(request.headers()).is_some_and(|origin| Some(origin) == request_host(request))
}

pub async fn reject_cross_origin_writes(request: Request, next: Next) -> Response {
    let read = matches!(*request.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    if !read && !same_origin(&request) {
        return AppError::forbidden("Cross-origin requests are not allowed.").into_response();
    }
    next.run(request).await
}
