use std::collections::BTreeSet;

use crate::title_id::TitleId;
use crate::transfers::{Entry, Progress};

const FILES_AHEAD: usize = 2;

struct File {
    episode: Option<(u32, u32)>,
    index: usize,
    done: bool,
}

fn episode_of(title_id: Option<&str>) -> Option<(u32, u32)> {
    match TitleId::parse(title_id?).ok()? {
        TitleId::Episode { season, episode, .. } => Some((season, episode)),
        TitleId::Title(_) => None,
    }
}

pub fn wanted_files(entry: &Entry, progress: &Progress) -> BTreeSet<usize> {
    let mut files: Vec<File> = entry
        .files
        .iter()
        .zip(&progress.per_file)
        .map(|(file, (_, have))| File { episode: episode_of(file.title_id.as_deref()), index: file.index, done: *have >= file.size_bytes })
        .collect();
    if files.iter().filter(|file| file.episode.is_some()).count() < 2 {
        return entry.selected();
    }
    files.sort_by_key(|file| (file.episode.is_none(), file.episode, file.index));
    let done = files.iter().filter(|file| file.done).map(|file| file.index);
    let next = files.iter().filter(|file| !file.done).take(FILES_AHEAD).map(|file| file.index);
    let watched = entry.focus.filter(|index| entry.files.iter().any(|file| file.index == *index));
    done.chain(next).chain(watched).collect()
}
