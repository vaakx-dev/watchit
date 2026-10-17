use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};

use futures::StreamExt;
use image::ImageFormat;
use reqwest::header::{ACCEPT, CONTENT_LENGTH, CONTENT_TYPE, LOCATION, RETRY_AFTER, USER_AGENT};
use reqwest::{Response, StatusCode};
use url::Url;

use crate::clock::now_ms;
use crate::failure::ImageFailure;
use crate::source::resolve;

const MAX_REDIRECTS: usize = 3;
const TIMEOUT: Duration = Duration::from_secs(15);
const RATE_LIMIT_MS: i64 = 60_000;
pub(crate) const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;

pub(crate) struct Downloaded {
    pub bytes: Vec<u8>,
    pub format: ImageFormat,
}

pub(crate) struct Transport {
    client: reqwest::Client,
    pauses: Mutex<HashMap<String, ImageFailure>>,
}

fn retry_at(response: &Response) -> i64 {
    let now = now_ms();
    let header = response.headers().get(RETRY_AFTER).and_then(|value| value.to_str().ok()).map(str::trim);
    let time = header.and_then(|value| match value.parse::<f64>() {
        Ok(seconds) if seconds >= 0.0 => Some(now + (seconds * 1000.0) as i64),
        _ => httpdate::parse_http_date(value).ok().and_then(|date| date.duration_since(UNIX_EPOCH).ok()).map(|at| at.as_millis() as i64),
    });
    match time {
        Some(time) => time.max(now),
        None if response.status() == StatusCode::TOO_MANY_REQUESTS => now + RATE_LIMIT_MS,
        None => 0,
    }
}

fn format_of(content_type: &str) -> Option<ImageFormat> {
    match content_type {
        "image/jpeg" => Some(ImageFormat::Jpeg),
        "image/png" => Some(ImageFormat::Png),
        "image/webp" => Some(ImageFormat::WebP),
        "image/gif" => Some(ImageFormat::Gif),
        _ => None,
    }
}

fn matches_format(bytes: &[u8], format: ImageFormat) -> bool {
    match format {
        ImageFormat::Jpeg => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        ImageFormat::Png => bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
        ImageFormat::Gif => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        ImageFormat::WebP => bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        _ => false,
    }
}

impl Transport {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(TIMEOUT)
            .read_timeout(TIMEOUT)
            .build()
            .expect("image http client");
        Self { client, pauses: Mutex::new(HashMap::new()) }
    }

    pub async fn download(&self, source: &str, limit: usize) -> Result<Downloaded, ImageFailure> {
        let mut url = Url::parse(&resolve(source, None)?).map_err(|_| ImageFailure::rejected("Invalid image URL"))?;
        for redirects in 0.. {
            let origin = url.origin().ascii_serialization();
            self.check_pause(&origin)?;
            let response = self
                .client
                .get(url.clone())
                .header(ACCEPT, "image/webp,image/png,image/jpeg,image/gif")
                .header(USER_AGENT, "Watchit/0.1 (local image cache)")
                .send()
                .await
                .map_err(|error| ImageFailure::unavailable(format!("Image request failed: {error}")))?;
            let status = response.status();
            if !status.is_redirection() {
                if status.is_success() {
                    return read_body(response, limit).await;
                }
                return Err(self.pause(origin, ImageFailure::origin(status.as_u16(), retry_at(&response))));
            }
            let location = response.headers().get(LOCATION).and_then(|value| value.to_str().ok());
            let Some(location) = location.filter(|_| redirects < MAX_REDIRECTS) else {
                return Err(ImageFailure::redirect(status.as_u16(), "redirect limit or missing location"));
            };
            let next = resolve(location, Some(&url)).map_err(|_| ImageFailure::redirect(status.as_u16(), "unsafe redirect"))?;
            url = Url::parse(&next).map_err(|_| ImageFailure::redirect(status.as_u16(), "unsafe redirect"))?;
        }
        unreachable!()
    }

    fn check_pause(&self, origin: &str) -> Result<(), ImageFailure> {
        let mut pauses = self.pauses.lock().unwrap();
        match pauses.get(origin) {
            Some(paused) if paused.retry_at() > now_ms() => Err(paused.clone()),
            _ => {
                pauses.remove(origin);
                Ok(())
            }
        }
    }

    fn pause(&self, origin: String, failure: ImageFailure) -> ImageFailure {
        let mut pauses = self.pauses.lock().unwrap();
        if let Some(current) = pauses.get(&origin).filter(|current| current.retry_at() > failure.retry_at()) {
            return current.clone();
        }
        if failure.retry_at() > now_ms() {
            pauses.insert(origin, failure.clone());
        }
        failure
    }
}

async fn read_body(response: Response, limit: usize) -> Result<Downloaded, ImageFailure> {
    let header = |name| response.headers().get(name).and_then(|value: &reqwest::header::HeaderValue| value.to_str().ok());
    let content_type = header(CONTENT_TYPE).and_then(|value| value.split(';').next()).map(|value| value.trim().to_ascii_lowercase());
    let format = content_type
        .as_deref()
        .and_then(format_of)
        .ok_or_else(|| ImageFailure::rejected("Unsupported image content type"))?;
    let declared = header(CONTENT_LENGTH).and_then(|value| value.parse::<usize>().ok()).unwrap_or(0);
    if declared > limit {
        return Err(ImageFailure::rejected("Image exceeds the size limit"));
    }
    let mut bytes = Vec::with_capacity(declared);
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| ImageFailure::unavailable(format!("Image download failed: {error}")))?;
        if bytes.len() + chunk.len() > limit {
            return Err(ImageFailure::rejected("Image exceeds the size limit"));
        }
        bytes.extend_from_slice(&chunk);
    }
    if !matches_format(&bytes, format) {
        return Err(ImageFailure::rejected("Image body does not match its raster content type"));
    }
    Ok(Downloaded { bytes, format })
}
