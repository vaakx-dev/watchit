use std::sync::LazyLock;

use percent_encoding::percent_decode_str;
use regex::Regex;
use url::Url;
use watchit_core::{AppError, AppResult};

static METAHUB: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/(?:poster/small|background/(?:medium|large))/tt\d+/img$").unwrap());
static EPISODES: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/tt\d+/\d+/\d+/w780\.jpg$").unwrap());
static TMDB: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/t/p/w780/[a-zA-Z0-9]+\.jpg$").unwrap());
static AMAZON: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/images/M/[a-zA-Z0-9@._,-]+\.(?:jpg|jpeg|png|webp)$").unwrap());
static PARTS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(?:https://([^/?#]+))?([^?#]*)(?:\?[^#]*)?$").unwrap());
static SCHEME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(?:[a-z][a-z\d+.-]*:|//)").unwrap());

fn host_paths(host: &str) -> Option<&'static Regex> {
    match host {
        "images.metahub.space" | "live.metahub.space" => Some(&METAHUB),
        "episodes.metahub.space" => Some(&EPISODES),
        "image.tmdb.org" => Some(&TMDB),
        "m.media-amazon.com" => Some(&AMAZON),
        _ => None,
    }
}

fn invalid() -> AppError {
    AppError::bad_request("Only approved HTTPS image hosts and paths are allowed")
}

fn unsafe_text(value: &str) -> bool {
    value.chars().any(|char| char <= ' ' || char == '\u{7f}' || char == '\\')
}

pub fn approved_url(source: &str) -> AppResult<String> {
    resolve(source, None)
}

pub(crate) fn resolve(source: &str, base: Option<&Url>) -> AppResult<String> {
    if unsafe_text(source) || source.contains('#') {
        return Err(invalid());
    }
    let parts = PARTS.captures(source).ok_or_else(invalid)?;
    let host = parts.get(1).map(|host| host.as_str().to_ascii_lowercase());
    match &host {
        None if base.is_none() || SCHEME.is_match(source) => return Err(invalid()),
        Some(host) if host_paths(host).is_none() => return Err(invalid()),
        _ => {}
    }
    let path = parts.get(2).map_or("", |path| path.as_str());
    let lowered = path.to_ascii_lowercase();
    if path.starts_with("//") || lowered.contains("%2f") || lowered.contains("%5c") {
        return Err(invalid());
    }
    let decoded = percent_decode_str(path).decode_utf8().map_err(|_| invalid())?;
    if unsafe_text(&decoded) || decoded.contains('%') || decoded.split('/').any(|part| part == "." || part == "..") {
        return Err(invalid());
    }
    let url = match base {
        Some(base) => base.join(source),
        None => Url::parse(source),
    }
    .map_err(|_| invalid())?;
    let approved = url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.host_str().and_then(host_paths).is_some_and(|paths| paths.is_match(url.path()));
    if !approved {
        return Err(invalid());
    }
    Ok(url.into())
}

pub fn backdrop_url(source: &str) -> AppResult<String> {
    let approved = approved_url(source)?;
    let url = Url::parse(&approved).map_err(|_| invalid())?;
    if !url.host_str().is_some_and(|host| host.ends_with(".metahub.space")) {
        return Ok(approved);
    }
    Ok(format!(
        "https://live.metahub.space{}",
        url.path().replace("/background/medium/", "/background/large/")
    ))
}
