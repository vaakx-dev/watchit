use serde::{Deserialize, Serialize};
use url::Url;

use crate::model::{ImageCredit, Title};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(crate) struct Credit {
    pub source: Option<String>,
    pub role: Option<String>,
    pub source_url: Option<String>,
    pub description_url: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub license_url: Option<String>,
    pub terms_url: Option<String>,
    pub retrieved_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(crate) struct ImageRecord {
    pub key: String,
    pub url: String,
    pub title_ids: Vec<String>,
    pub first_recorded_at: String,
    pub last_recorded_at: String,
    pub credits: Vec<Credit>,
}

pub(crate) struct LocalImage {
    pub key: String,
    pub url: String,
    pub credit: Credit,
}

#[derive(Serialize)]
struct SeriesName<'a> {
    id: &'a str,
    title: &'a str,
}

#[derive(Serialize)]
struct Metadata<'a> {
    source: &'static str,
    source_url: Option<String>,
    license: Option<String>,
    license_url: Option<String>,
    title: &'a str,
    year: Option<i64>,
    kind: &'static str,
    anime: bool,
    genres: &'a [String],
    minutes: Option<i64>,
    synopsis: &'a str,
    director: &'a str,
    cast: &'a str,
    imdb_id: Option<&'a str>,
    tmdb_id: Option<i64>,
    season: Option<i64>,
    episode: Option<i64>,
    series: Option<SeriesName<'a>>,
}

#[derive(Serialize)]
struct ImageReference<'a> {
    key: &'a str,
    url: &'a str,
}

#[derive(Serialize)]
pub(crate) struct TitleRecord<'a> {
    id: &'a str,
    recorded_at: &'a str,
    metadata: Metadata<'a>,
    artwork: Option<String>,
    backdrop: Option<String>,
    images: Vec<ImageReference<'a>>,
}

pub(crate) fn public_url(value: &str) -> Option<String> {
    let mut url = Url::parse(value).ok()?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return None;
    }
    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_query(None);
    url.set_fragment(None);
    Some(url.into())
}

fn local(value: &str) -> Option<(String, String)> {
    let path = value.split(['?', '#']).next().unwrap_or_default();
    let key = path.strip_prefix("/api/images/")?;
    watchit_artwork::ImageKey::parse(key).map(|key| (key.as_str().to_owned(), path.to_owned()))
}

fn filled(value: &str) -> Option<String> {
    (!value.is_empty()).then(|| value.to_owned())
}

fn credit(image: Option<&ImageCredit>) -> Credit {
    Credit {
        source: image.map(|image| image.source.to_owned()),
        role: image.map(|image| image.role.to_owned()),
        source_url: image.and_then(|image| public_url(&image.source_url)),
        description_url: image.and_then(|image| public_url(&image.description_url)),
        author: image.and_then(|image| filled(image.author)),
        license: image.and_then(|image| filled(image.license)),
        license_url: image.and_then(|image| public_url(image.license_url)),
        terms_url: image.and_then(|image| public_url(image.terms_url)),
        retrieved_at: image.and_then(|image| image.retrieved_at.clone()),
    }
}

pub(crate) fn local_images(title: &Title) -> Vec<LocalImage> {
    let mut images: Vec<LocalImage> = title
        .images
        .iter()
        .filter_map(|image| {
            local(&image.url).map(|(key, url)| LocalImage {
                key,
                url,
                credit: credit(Some(image)),
            })
        })
        .collect();
    for value in [&title.entry.artwork, &title.backdrop] {
        if let Some((key, url)) = local(value)
            && images.iter().all(|image| image.key != key)
        {
            images.push(LocalImage {
                key,
                url,
                credit: credit(None),
            });
        }
    }
    images
}

pub(crate) fn title_record<'a>(title: &'a Title, images: &'a [LocalImage], recorded_at: &'a str) -> TitleRecord<'a> {
    let mut references: Vec<ImageReference<'_>> = Vec::new();
    for image in images {
        if references.iter().all(|reference| reference.key != image.key) {
            references.push(ImageReference {
                key: &image.key,
                url: &image.url,
            });
        }
    }
    TitleRecord {
        id: &title.entry.id,
        recorded_at,
        metadata: Metadata {
            source: "cinemeta",
            source_url: public_url(&title.source_url),
            license: None,
            license_url: None,
            title: &title.entry.title,
            year: title.entry.year,
            kind: title.entry.kind.as_str(),
            anime: title.entry.anime,
            genres: &title.entry.genres,
            minutes: title.minutes,
            synopsis: &title.synopsis,
            director: &title.director,
            cast: &title.cast,
            imdb_id: title.imdb_id.as_deref(),
            tmdb_id: title.tmdb_id,
            season: title.season,
            episode: title.episode,
            series: title.series.as_ref().map(|series| SeriesName {
                id: &series.id,
                title: &series.title,
            }),
        },
        artwork: local(&title.entry.artwork).map(|(_, url)| url),
        backdrop: local(&title.backdrop).map(|(_, url)| url),
        images: references,
    }
}
