use std::collections::BTreeMap;

use super::record::{Choice, FileRecord, Pick};
use crate::engine::MetadataFile;
use crate::locations::subtitles::{self, Video};
use crate::release::{episode, files};
use crate::title_id::TitleId;

struct Context<'a> {
    title: TitleId,
    series: Option<String>,
    torrent_name: &'a str,
}

impl Context<'_> {
    fn episode_of(&self, file: &MetadataFile) -> Option<String> {
        let series = self.series.as_deref()?;
        let found = episode::file_episode(&file.path, self.torrent_name)?;
        Some(TitleId::episode(series, found.season, found.episode).to_string())
    }

    fn title_of(&self, file: &MetadataFile, explicit: bool) -> Option<String> {
        if !files::is_video(&file.path) {
            return None;
        }
        match &self.series {
            Some(_) => self.episode_of(file).or_else(|| (explicit && self.title.is_episode()).then(|| self.title.to_string())),
            None => Some(self.title.to_string()),
        }
    }
}

fn main_file(available: &[MetadataFile]) -> Option<&MetadataFile> {
    available
        .iter()
        .filter(|file| files::is_feature(&file.path))
        .max_by_key(|file| file.size_bytes)
        .or_else(|| available.iter().max_by_key(|file| file.size_bytes))
}

fn record(file: &MetadataFile, title_id: Option<String>) -> FileRecord {
    FileRecord { index: file.index, name: file.path.clone(), size_bytes: file.size_bytes, title_id }
}

fn with_subtitles(mut chosen: Vec<FileRecord>, available: &[MetadataFile], torrent_name: &str) -> Vec<FileRecord> {
    let videos: Vec<Video> = chosen
        .iter()
        .filter(|file| files::is_video(&file.name))
        .filter_map(|file| file.title_id.as_deref().map(|title_id| Video { path: &file.name, title_id }))
        .collect();
    let companions: Vec<FileRecord> = available
        .iter()
        .filter(|file| subtitles::is_subtitle(&file.path) && !chosen.iter().any(|known| known.index == file.index))
        .filter(|file| subtitles::owner(&file.path, &videos, torrent_name).is_some())
        .map(|file| record(file, None))
        .collect();
    chosen.extend(companions);
    chosen
}

fn pick_files(pick: &Pick, available: &[MetadataFile], torrent_name: &str) -> Vec<FileRecord> {
    let Ok(title) = TitleId::parse(&pick.title_id) else { return Vec::new() };
    let series = match &pick.choice {
        Choice::Season { .. } => Some(pick.title_id.clone()),
        _ => title.series().map(str::to_owned),
    };
    let context = Context { title, series, torrent_name };
    let chosen = match &pick.choice {
        Choice::Files { indexes } => available
            .iter()
            .filter(|file| indexes.contains(&file.index))
            .map(|file| record(file, context.title_of(file, true)))
            .collect(),
        Choice::Main => main_file(available).map(|file| record(file, context.title_of(file, true))).into_iter().collect(),
        Choice::All => {
            let main = main_file(available).map(|file| file.index);
            available
                .iter()
                .map(|file| {
                    let title = match context.series {
                        Some(_) => context.title_of(file, false),
                        None => (Some(file.index) == main).then(|| context.title_of(file, true)).flatten(),
                    };
                    record(file, title)
                })
                .collect()
        }
        Choice::Season { season } => available
            .iter()
            .filter(|file| files::is_feature(&file.path))
            .filter(|file| episode::file_episode(&file.path, torrent_name).is_some_and(|found| found.season == *season))
            .map(|file| record(file, context.episode_of(file)))
            .collect(),
    };
    with_subtitles(chosen, available, torrent_name)
}

pub fn resolve(picks: &[Pick], available: &[MetadataFile], torrent_name: &str, existing: &[FileRecord]) -> Vec<FileRecord> {
    let mut chosen: BTreeMap<usize, FileRecord> = existing.iter().map(|file| (file.index, file.clone())).collect();
    for pick in picks {
        for file in pick_files(pick, available, torrent_name) {
            match chosen.get_mut(&file.index) {
                Some(known) if known.title_id.is_none() => known.title_id = file.title_id,
                Some(_) => {}
                None => {
                    chosen.insert(file.index, file);
                }
            }
        }
    }
    chosen.into_values().collect()
}
