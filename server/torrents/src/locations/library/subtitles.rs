use std::path::Path;

use super::language;
use crate::release::episode::{self, EpisodeNumber};
use crate::release::files;
use crate::title_id::TitleId;

const EXTENSIONS: [&str; 7] = ["srt", "ass", "ssa", "vtt", "sub", "idx", "sup"];
const FORCED: [&str; 1] = ["forced"];
const SDH: [&str; 2] = ["sdh", "cc"];

pub struct Video<'a> {
    pub path: &'a str,
    pub title_id: &'a str,
}

pub fn is_subtitle(path: &str) -> bool {
    files::extension(path).is_some_and(|extension| EXTENSIONS.contains(&extension.as_str()))
}

fn stem(path: &str) -> String {
    Path::new(path).file_stem().unwrap_or_default().to_string_lossy().to_lowercase()
}

fn is_episode(title_id: &str, found: EpisodeNumber) -> bool {
    matches!(TitleId::parse(title_id), Ok(TitleId::Episode { season, episode, .. }) if season == found.season && episode == found.episode)
}

pub fn owner(subtitle: &str, videos: &[Video], torrent_name: &str) -> Option<usize> {
    if let Some(found) = episode::file_episode(subtitle, torrent_name) {
        return videos.iter().position(|video| is_episode(video.title_id, found));
    }
    let subtitle_stem = stem(subtitle);
    videos.iter().position(|video| subtitle_stem.starts_with(&stem(video.path))).or_else(|| (videos.len() == 1).then_some(0))
}

fn tokens(subtitle: &str, video: &str) -> Vec<String> {
    let subtitle_stem = stem(subtitle);
    let own = subtitle_stem.strip_prefix(&stem(video)).unwrap_or(&subtitle_stem).to_owned();
    let folders = Path::new(subtitle).parent().map(|parent| parent.to_string_lossy().to_lowercase()).unwrap_or_default();
    format!("{folders} {own}")
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
        .collect()
}

pub fn suffix(subtitle: &str, video: &str) -> String {
    let words = tokens(subtitle, video);
    let has = |list: &[&str]| words.iter().any(|token| list.contains(&token.as_str()));
    let mut parts: Vec<&str> = language::detect(&words).into_iter().collect();
    if has(&FORCED) {
        parts.push("forced");
    }
    if has(&SDH) {
        parts.push("sdh");
    }
    let extension = files::extension(subtitle).unwrap_or_default();
    parts.push(&extension);
    format!(".{}", parts.join("."))
}
