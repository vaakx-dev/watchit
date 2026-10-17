use crate::release::files::{is_feature, is_video};
use crate::transfers::{Entry, Progress};

pub struct Target {
    pub index: usize,
    pub size_bytes: u64,
    pub title_id: String,
    pub position: u64,
    pub complete: bool,
}

fn videos(entry: &Entry) -> Vec<usize> {
    let features: Vec<usize> = entry.files.iter().filter(|file| is_feature(&file.name)).map(|file| file.index).collect();
    if features.is_empty() { entry.files.iter().filter(|file| is_video(&file.name)).map(|file| file.index).collect() } else { features }
}

pub fn choose(entry: &Entry, progress: &Progress) -> Option<Target> {
    let videos = videos(entry);
    let complete = |index: usize| {
        let file = entry.files.iter().find(|file| file.index == index)?;
        let have = progress.per_file.iter().find(|(known, _)| *known == index).map_or(0, |(_, have)| *have);
        Some(have >= file.size_bytes)
    };
    let watching = entry.readiness.playhead.get().filter(|_| entry.readers > 0).filter(|position| videos.contains(&position.file));
    let (index, position) = match watching {
        Some(position) => (position.file, position.offset),
        None => {
            let next = videos.iter().copied().find(|index| complete(*index) == Some(false)).or_else(|| videos.first().copied())?;
            (next, 0)
        }
    };
    let file = entry.files.iter().find(|file| file.index == index)?;
    Some(Target {
        index,
        size_bytes: file.size_bytes,
        title_id: file.title_id.clone().unwrap_or_else(|| entry.record.title_id.clone()),
        position: position.min(file.size_bytes),
        complete: complete(index) == Some(true),
    })
}
