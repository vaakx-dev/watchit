use std::sync::LazyLock;

use regex::Regex;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Coverage {
    pub seasons: Vec<u32>,
    pub episodes: Vec<u32>,
    pub complete: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EpisodeNumber {
    pub season: u32,
    pub episode: u32,
}

fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid episode regex")
}

static SEASON_EPISODE: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        regex(r"(?i)(?:^|[^a-z0-9])s(\d{1,2})[ ._-]*e[ ._-]?(\d{1,4})((?:[ ._-]*(?:-|&|\+)?[ ._-]*e[ ._-]?\d{1,4})*(?:-\d{1,4}\b)?)"),
        regex(r"(?i)\bseason[ ._-]*(\d{1,2})[ ._-]*episode[ ._-]*(\d{1,4})\b()"),
        regex(r"(?:^|[^\dA-Za-z])(\d{1,2})[xх](\d{2,3})((?:[xх-]\d{2,3})*)(?:[^\dA-Za-z]|$)"),
        regex(r"(?i)(?:^|[^a-z0-9])s(\d{1,2})[ ._]*-[ ._]*(\d{2,3})\b()"),
    ]
});

static SEASON_RANGES: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        regex(r"(?i)(?:^|[^a-z0-9])s(\d{1,2})[ ._]*-[ ._]*s(\d{1,2})\b"),
        regex(r"(?i)\bseasons?[ ._-]*(\d{1,2})[ ._]*(?:-|to|thru|through|and|&)[ ._]*(\d{1,2})\b"),
        regex(r"(?i)\b(?:сезоны?|сезон)[: ._]*(\d{1,2})[ ._]*-[ ._]*(\d{1,2})\b"),
    ]
});

static SEASONS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        regex(r"(?i)(?:^|[^a-z0-9])s(\d{1,2})(?:[^a-z0-9]|$)"),
        regex(r"(?i)\b(?:season|saison|seizoen|stagione|staffel|temporada|series)[ ._:-]*(\d{1,2})\b"),
        regex(r"(?i)\b(\d{1,2})(?:st|nd|rd|th)[ ._-]*season\b"),
        regex(r"(?i)сезон[: ._№]*(\d{1,2})"),
        regex(r"(?i)(\d{1,2})[ ._-]*сезон"),
    ]
});

static EPISODE_RANGES: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        regex(r"(?i)\b(?:episodes?|eps?|e)[ ._]*(\d{1,4})[ ._]*-[ ._]*e?(\d{1,4})\b"),
        regex(r"(?i)серии[: ._]*(\d{1,4})[ ._]*-[ ._]*(\d{1,4})"),
    ]
});

static EPISODES: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        regex(r"(?i)(?:^|[^a-z0-9])(?:e|ep|episode)[ ._#-]*(\d{1,4})(?:v\d)?(?:[^a-z0-9]|$)"),
        regex(r"(?i)(?:серия|эпизод)[: ._№]*(\d{1,4})"),
        regex(r"(?i)(\d{1,4})[ ._-]*(?:серия|эпизод)"),
        regex(r"\s-\s(\d{1,4})(?:v\d)?(?:\s|\[|\(|\.|$)"),
        regex(r"^\[[^\]]+\][^\[]*?[ ._](\d{2,4})(?:v\d)?[ ._]*[\[(]"),
        regex(r"^(\d{1,2})(?:[ ._-]|$)"),
    ]
});

static COMPLETE: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b(complete|integrale|полный)\b"));

fn number(text: &str) -> Option<u32> {
    text.parse().ok()
}

fn expand(start: u32, end: u32) -> Vec<u32> {
    if end >= start && end - start < 200 {
        (start..=end).collect()
    } else {
        vec![start]
    }
}

fn tail_numbers(tail: &str) -> Vec<u32> {
    static DIGITS: LazyLock<Regex> = LazyLock::new(|| regex(r"\d{1,4}"));
    DIGITS.find_iter(tail).filter_map(|found| number(found.as_str())).collect()
}

fn episode_list(first: u32, tail: &str) -> Vec<u32> {
    let rest = tail_numbers(tail);
    match rest.as_slice() {
        [] => vec![first],
        [last] if tail.trim_start_matches([' ', '.', '_']).starts_with('-') => expand(first, *last),
        _ => std::iter::once(first).chain(rest).collect(),
    }
}

pub fn season_episode(text: &str) -> Option<(u32, Vec<u32>)> {
    SEASON_EPISODE.iter().find_map(|pattern| {
        let found = pattern.captures(text)?;
        let season = number(&found[1])?;
        let first = number(&found[2])?;
        let tail = found.get(3).map_or("", |tail| tail.as_str());
        Some((season, episode_list(first, tail)))
    })
}

pub fn seasons(text: &str) -> Vec<u32> {
    if let Some(found) = SEASON_RANGES.iter().find_map(|pattern| pattern.captures(text))
        && let (Some(start), Some(end)) = (number(&found[1]), number(&found[2]))
    {
        return expand(start, end);
    }
    SEASONS
        .iter()
        .find_map(|pattern| pattern.captures(text))
        .and_then(|found| number(&found[1]))
        .into_iter()
        .collect()
}

pub fn episodes(text: &str) -> Vec<u32> {
    if let Some(found) = EPISODE_RANGES.iter().find_map(|pattern| pattern.captures(text))
        && let (Some(start), Some(end)) = (number(&found[1]), number(&found[2]))
    {
        return expand(start, end);
    }
    EPISODES
        .iter()
        .find_map(|pattern| pattern.captures(text))
        .and_then(|found| number(&found[1]))
        .into_iter()
        .collect()
}

pub fn coverage(title: &str) -> Coverage {
    if let Some((season, episodes)) = season_episode(title) {
        return Coverage {
            seasons: vec![season],
            episodes,
            complete: false,
        };
    }
    Coverage {
        seasons: seasons(title),
        episodes: episodes(title),
        complete: COMPLETE.is_match(title),
    }
}

impl Coverage {
    pub fn is_pack_for(&self, season: u32) -> bool {
        let has_season = self.seasons.contains(&season) || (self.seasons.is_empty() && self.complete);
        has_season && self.episodes.len() != 1
    }
}

fn components(path: &str) -> Vec<&str> {
    path.split(['/', '\\']).filter(|part| !part.is_empty()).collect()
}

fn stem(name: &str) -> &str {
    match name.rsplit_once('.') {
        Some((stem, extension)) if extension.len() <= 4 && !extension.contains(' ') => stem,
        _ => name,
    }
}

pub fn file_episode(path: &str, torrent_name: &str) -> Option<EpisodeNumber> {
    let parts = components(path);
    let (file, folders) = parts.split_last()?;
    let file = stem(file);
    if let Some((season, episodes)) = season_episode(file) {
        return Some(EpisodeNumber {
            season,
            episode: *episodes.first()?,
        });
    }
    let episode = *episodes(file).first()?;
    let season = folders
        .iter()
        .rev()
        .find_map(|folder| {
            season_episode(folder)
                .map(|(season, _)| season)
                .or_else(|| seasons(folder).first().copied())
        })
        .or_else(|| match seasons(torrent_name).as_slice() {
            [season] => Some(*season),
            _ => None,
        })?;
    Some(EpisodeNumber { season, episode })
}
