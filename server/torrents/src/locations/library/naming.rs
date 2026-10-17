use std::path::{Path, PathBuf};

use crate::titles::TitleName;

const INVALID: &str = r#"<>"/\|?*"#;

pub fn clean(name: &str) -> String {
    let spaced = name.replace(": ", " - ").replace(':', "-");
    let kept: String = spaced.chars().filter(|c| !c.is_control() && !INVALID.contains(*c)).collect();
    let single = kept.split_whitespace().collect::<Vec<_>>().join(" ");
    single.trim_end_matches(['.', ' ']).to_owned()
}

fn with_year(name: &TitleName) -> String {
    match name.year {
        Some(year) => format!("{} ({year})", clean(&name.title)),
        None => clean(&name.title),
    }
}

pub fn movie(movies: &Path, movie: &TitleName) -> PathBuf {
    let base = with_year(movie);
    movies.join(&base).join(base)
}

fn season_folder(season: u32) -> String {
    if season == 0 { "Specials".to_owned() } else { format!("Season {season:02}") }
}

pub struct EpisodeName<'a> {
    pub series: &'a TitleName,
    pub season: u32,
    pub episode: u32,
    pub title: Option<&'a str>,
}

pub fn episode(shows: &Path, name: &EpisodeName) -> PathBuf {
    let numbered = format!("{} - S{:02}E{:02}", clean(&name.series.title), name.season, name.episode);
    let file = match name.title.map(clean).filter(|title| !title.is_empty()) {
        Some(title) => format!("{numbered} - {title}"),
        None => numbered,
    };
    shows.join(with_year(name.series)).join(season_folder(name.season)).join(file)
}
