use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;
use watchit_artwork::{approved_url, backdrop_url};

use crate::cinemeta::meta::{Fields, Meta};
use crate::genres::normalize;
use crate::ids::{genre_id, is_imdb_id};
use crate::model::{MediaKind, SeriesRef};
use crate::store::record::{Detail, Record};

pub(crate) const BASE_URL: &str = "https://v3-cinemeta.strem.io";

static YOUTUBE_ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-]{11}$").unwrap());
static RUNTIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d+)\s*(?:min|minutes)?$").unwrap());
static YEAR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})").unwrap());

pub(crate) fn meta_url(kind: MediaKind, id: &str) -> String {
    format!("{BASE_URL}/meta/{}/{id}.json", kind.as_str())
}

fn year(value: Option<String>) -> Option<i64> {
    YEAR.captures(&value?).and_then(|captures| captures[1].parse().ok())
}

fn names(fields: &Fields, key: &str) -> String {
    match fields.value(key) {
        Some(Value::Array(values)) => values.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(", "),
        Some(Value::String(text)) => text.clone(),
        _ => String::new(),
    }
}

fn imdb_rating(fields: &Fields) -> Option<f64> {
    let text = fields.first_text(&["imdbRating"])?;
    let rating: f64 = text.trim().parse().ok()?;
    (rating > 0.0 && rating <= 10.0).then_some(rating)
}

fn trailers(fields: &Fields) -> Vec<String> {
    let mut ids: Vec<String> = Vec::new();
    for trailer in fields.value("trailers").and_then(Value::as_array).into_iter().flatten() {
        let source = trailer.get("source").and_then(Value::as_str);
        let is_trailer = trailer.get("type").and_then(Value::as_str) == Some("Trailer");
        if let Some(source) = source.filter(|source| is_trailer && YOUTUBE_ID.is_match(source))
            && !ids.iter().any(|id| id == source)
        {
            ids.push(source.to_owned());
        }
    }
    ids
}

pub(crate) fn media_kind(meta: &Meta) -> Option<MediaKind> {
    match meta.kind() {
        "movie" => Some(MediaKind::Movie),
        "series" => Some(MediaKind::Series),
        _ => None,
    }
}

pub(crate) fn valid(meta: &Meta) -> bool {
    is_imdb_id(meta.id()) && media_kind(meta).is_some() && meta.fields.text("name").is_some_and(|name| !name.trim().is_empty())
}

struct Classification {
    anime: bool,
    known: bool,
}

fn classify(meta: &Meta, labels: &[String]) -> Classification {
    let ids: Vec<String> = labels.iter().map(|label| genre_id(label)).collect();
    let animation = ids.iter().any(|id| id == "animation");
    let anime = ids.iter().any(|id| id == "anime") || (animation && meta.primary_country().as_deref() == Some("japan"));
    Classification { anime, known: anime || !animation || meta.fields.has("country") }
}

pub(crate) fn lacks(meta: &Meta, anime: bool, genres: bool) -> bool {
    match meta.genre_labels() {
        None => anime || genres,
        Some(labels) => anime && !classify(meta, &labels).known,
    }
}

pub(crate) fn apply(previous: Option<Record>, meta: &Meta) -> Option<Record> {
    if !valid(meta) {
        return None;
    }
    let kind = media_kind(meta)?;
    let id = meta.id();
    let fields = &meta.fields;
    let mut record = previous.filter(|record| record.kind == kind).unwrap_or_else(|| Record::new(id, kind));
    record.title = fields.text("name").unwrap_or_default().to_owned();
    record.detail.imdb_id = Some(id.to_owned());
    record.detail.source_url = meta_url(kind, id);
    if let Some(labels) = meta.genre_labels() {
        let classification = classify(meta, &labels);
        if classification.known {
            record.anime = classification.anime;
        }
        record.genres = normalize(labels.iter().map(String::as_str));
    }
    if fields.has("releaseInfo") || fields.has("year") || fields.has("released") {
        record.year = year(fields.first_text(&["releaseInfo", "year", "released"]));
    }
    if fields.has("runtime") {
        record.detail.minutes = fields
            .first_text(&["runtime"])
            .and_then(|runtime| RUNTIME.captures(&runtime).and_then(|captures| captures[1].parse::<i64>().ok()))
            .filter(|minutes| *minutes > 0);
    }
    if fields.has("description") {
        record.detail.synopsis = fields.text("description").unwrap_or_default().to_owned();
    }
    if fields.has("director") {
        record.detail.director = names(fields, "director");
    }
    if fields.has("cast") {
        record.detail.cast = names(fields, "cast");
    }
    if fields.has("moviedb_id") {
        record.detail.tmdb_id = fields.number("moviedb_id").filter(|id| id.fract() == 0.0 && *id > 0.0).map(|id| id as i64);
    }
    if fields.has("poster") {
        record.detail.poster = fields.text("poster").and_then(|url| approved_url(url).ok());
    }
    if fields.has("background") {
        record.detail.background = fields.text("background").and_then(|url| backdrop_url(url).ok().map(|_| url.to_owned()));
    }
    if fields.has("imdbRating") {
        record.imdb_rating = imdb_rating(fields);
    }
    if fields.has("popularity") {
        record.popularity = fields.number("popularity");
    }
    if fields.has("trailers") {
        record.detail.trailers = trailers(fields);
    }
    Some(record)
}

pub(crate) fn episodes(meta: &Meta, parent: &Record) -> Vec<Record> {
    let mut episodes: Vec<Record> = Vec::new();
    for video in meta.videos() {
        let Some(episode) = episode(&video, parent) else { continue };
        match episodes.iter_mut().find(|known| known.id == episode.id) {
            Some(known) => *known = episode,
            None => episodes.push(episode),
        }
    }
    episodes.sort_by_key(|episode| (episode.season, episode.episode));
    episodes
}

fn episode(video: &Fields, parent: &Record) -> Option<Record> {
    let season = video.coordinate("season")??;
    let number = video.coordinate("episode").or_else(|| video.coordinate("number"))??;
    if let (Some(left), Some(right)) = (video.coordinate("episode"), video.coordinate("number"))
        && left != right
    {
        return None;
    }
    let id = format!("{}:{season}:{number}", parent.id);
    if video.text("id").is_some_and(|value| !value.is_empty() && value != id) {
        return None;
    }
    let title = video.text("name").or_else(|| video.text("title")).map_or_else(|| format!("Episode {number}"), str::to_owned);
    Some(Record {
        id,
        kind: MediaKind::Episode,
        title,
        year: year(video.first_text(&["released", "firstAired"])),
        genres: parent.genres.clone(),
        anime: parent.anime,
        imdb_rating: None,
        popularity: None,
        season: Some(season),
        episode: Some(number),
        detail: Detail {
            synopsis: video.text("description").or_else(|| video.text("overview")).unwrap_or_default().to_owned(),
            poster: video.text("thumbnail").and_then(|url| approved_url(url).ok()),
            source_url: parent.detail.source_url.clone(),
            series: Some(SeriesRef {
                id: parent.id.clone(),
                title: parent.title.clone(),
                imdb_id: parent.detail.imdb_id.clone(),
                tmdb_id: parent.detail.tmdb_id,
            }),
            ..Detail::default()
        },
    })
}
