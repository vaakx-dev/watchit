use serde::Serialize;
use ts_rs::TS;

use crate::ids::genre_id;

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct GenreOption {
    pub id: String,
    pub label: String,
    pub minor: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Genre {
    pub id: String,
    pub label: String,
}

const MINOR: [&str; 7] = ["reality-tv", "talk-show", "game-show", "news", "soap", "tv-movie", "short"];

pub(crate) fn canonical_ids(id: &str) -> Vec<&str> {
    match id {
        "sci-fi" => vec!["science-fiction"],
        "sci-fi-fantasy" => vec!["science-fiction", "fantasy"],
        "action-adventure" => vec!["action", "adventure"],
        "war-politics" => vec!["war"],
        "reality" => vec!["reality-tv"],
        "talk" => vec!["talk-show"],
        "kids" => vec!["family"],
        "adult" => vec![],
        other => vec![other],
    }
}

fn canonical_label(id: &str) -> Option<&'static str> {
    Some(match id {
        "science-fiction" => "Sci-Fi",
        "fantasy" => "Fantasy",
        "action" => "Action",
        "adventure" => "Adventure",
        "war" => "War",
        "reality-tv" => "Reality-TV",
        "talk-show" => "Talk-Show",
        "family" => "Family",
        _ => return None,
    })
}

pub(crate) fn is_minor(id: &str) -> bool {
    MINOR.contains(&id)
}

pub(crate) fn normalize<'a>(labels: impl IntoIterator<Item = &'a str>) -> Vec<Genre> {
    let mut genres: Vec<Genre> = Vec::new();
    for label in labels {
        let source = genre_id(label);
        if source.is_empty() {
            continue;
        }
        for id in canonical_ids(&source) {
            if genres.iter().all(|genre| genre.id != id) {
                let label = canonical_label(id).map_or_else(|| label.to_owned(), str::to_owned);
                genres.push(Genre { id: id.to_owned(), label });
            }
        }
    }
    genres
}
