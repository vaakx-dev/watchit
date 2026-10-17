use std::io::SeekFrom;

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};
use futures::StreamExt;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use watchit_core::{AppError, AppResult};

use super::mime::content_type;
use super::range::{Requested, requested};
use crate::service::Torrents;

const CHUNK: usize = 64 * 1024;

fn header_value(text: String) -> AppResult<HeaderValue> {
    HeaderValue::from_str(&text).map_err(AppError::internal)
}

pub async fn raw(
    State(torrents): State<Torrents>,
    Path((info_hash, file_index)): Path<(String, usize)>,
    method: Method,
    headers: HeaderMap,
) -> AppResult<Response> {
    let transfers = torrents.transfers().await?;
    let info_hash = info_hash.to_ascii_lowercase();
    let mut opened = transfers.open_file(&info_hash, file_index).await?;
    let len = opened.len;

    let mut out = HeaderMap::new();
    out.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    out.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type(&opened.name)));
    let (status, start, take) = match requested(&headers, len) {
        Requested::Whole => (StatusCode::OK, 0, len),
        Requested::Part(range) => {
            out.insert(header::CONTENT_RANGE, header_value(format!("bytes {}-{}/{len}", range.start, range.end))?);
            (StatusCode::PARTIAL_CONTENT, range.start, range.len())
        }
        Requested::Unsatisfiable => {
            out.insert(header::CONTENT_RANGE, header_value(format!("bytes */{len}"))?);
            return Ok((StatusCode::RANGE_NOT_SATISFIABLE, out).into_response());
        }
    };
    out.insert(header::CONTENT_LENGTH, HeaderValue::from(take));
    if method == Method::HEAD || take == 0 {
        return Ok((status, out).into_response());
    }
    opened.reader.seek(SeekFrom::Start(start)).await.map_err(AppError::internal)?;
    let guard = opened.guard;
    let body = ReaderStream::with_capacity(opened.reader.take(take), CHUNK).map(move |chunk| {
        let _reading = &guard;
        chunk
    });
    Ok((status, out, Body::from_stream(body)).into_response())
}
