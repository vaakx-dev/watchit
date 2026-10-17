use std::sync::LazyLock;

use regex::Regex;

static TITLE_ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^tt\d{7,12}(?::\d{1,5}:\d{1,5})?$").unwrap());
static IMDB_ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^tt\d{7,12}$").unwrap());
static GENRE_ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").unwrap());

pub fn is_title_id(id: &str) -> bool {
    TITLE_ID.is_match(id)
}

pub fn is_imdb_id(id: &str) -> bool {
    IMDB_ID.is_match(id)
}

pub fn is_genre_id(id: &str) -> bool {
    GENRE_ID.is_match(id)
}

pub fn genre_id(label: &str) -> String {
    let mut id = String::with_capacity(label.len());
    for char in label.trim().to_lowercase().chars() {
        if char.is_ascii_lowercase() || char.is_ascii_digit() {
            id.push(char);
        } else if !id.ends_with('-') {
            id.push('-');
        }
    }
    id.trim_matches('-').to_owned()
}
