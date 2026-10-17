use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::Ordering;

use super::LibraryLink;
use super::link::{Placement, free_name, place, unplace};
use super::naming::{self, EpisodeName};
use super::subtitles::{Video, is_subtitle, owner, suffix};
use crate::engine::Handle;
use crate::locations::layout::library_roots;
use crate::release::{files, video};
use crate::title_id::TitleId;
use crate::transfers::model::Kind;
use crate::transfers::{Entry, Transfers};

struct Source {
    index: usize,
    name: String,
    path: PathBuf,
}

struct Job {
    info_hash: String,
    title_id: String,
    labels: Vec<String>,
    video: Source,
    subtitles: Vec<Source>,
}

fn source(transfers: &Transfers, handle: &Handle, index: usize, name: &str) -> Option<Source> {
    let path = transfers.disk_path(handle, index).ok()?;
    Some(Source { index, name: name.to_owned(), path })
}

fn labels(entry: &Entry, file_name: &str) -> Vec<String> {
    let text = format!("{} {file_name}", entry.record.name);
    let resolution = video::resolution(&text).map(|resolution| resolution.label().to_owned());
    resolution.into_iter().chain([entry.record.info_hash[..8].to_owned()]).collect()
}

fn jobs_of(transfers: &Transfers, entry: &Entry) -> Vec<Job> {
    let Some(handle) = entry.handle.as_ref().filter(|_| entry.record.kind == Kind::Download && entry.relocation.is_none()) else {
        return Vec::new();
    };
    let videos: Vec<Video> = entry
        .files
        .iter()
        .filter(|file| files::is_video(&file.name))
        .filter_map(|file| file.title_id.as_deref().map(|title_id| Video { path: &file.name, title_id }))
        .collect();
    let mut jobs = Vec::new();
    for (position, wanted) in videos.iter().enumerate() {
        let Some(file) = entry.files.iter().find(|file| file.name == wanted.path) else { continue };
        let linked = entry.library.iter().any(|link| link.file_index == file.index);
        if linked || entry.import_failed.contains(&file.index) || !entry.file_complete(file.index) {
            continue;
        }
        let owned: Vec<_> = entry
            .files
            .iter()
            .filter(|other| is_subtitle(&other.name) && owner(&other.name, &videos, &entry.record.name) == Some(position))
            .collect();
        if owned.iter().any(|subtitle| !entry.file_complete(subtitle.index)) {
            continue;
        }
        let Some(video) = source(transfers, handle, file.index, &file.name) else { continue };
        jobs.push(Job {
            info_hash: entry.record.info_hash.clone(),
            title_id: wanted.title_id.to_owned(),
            labels: labels(entry, &file.name),
            video,
            subtitles: owned.iter().filter_map(|subtitle| source(transfers, handle, subtitle.index, &subtitle.name)).collect(),
        });
    }
    jobs
}

fn without_extension(path: &Path) -> PathBuf {
    path.with_extension("")
}

fn place_job(job: &Job, base: &Path) -> std::io::Result<Vec<LibraryLink>> {
    let extension = files::extension(&job.video.name).unwrap_or_default();
    let mut placed: Vec<LibraryLink> = Vec::new();
    let video_path = free_name(base, &format!(".{extension}"), &job.labels);
    let mut steps = vec![(job.video.index, Placement { from: job.video.path.clone(), to: video_path.clone() })];
    let video_base = without_extension(&video_path);
    for subtitle in &job.subtitles {
        let to = free_name(&video_base, &suffix(&subtitle.name, &job.video.name), &[]);
        steps.push((subtitle.index, Placement { from: subtitle.path.clone(), to }));
    }
    for (file_index, step) in steps {
        if let Err(error) = place(&step) {
            for link in &placed {
                let _ = std::fs::remove_file(&link.path);
            }
            return Err(error);
        }
        placed.push(LibraryLink { file_index, path: step.to });
    }
    Ok(placed)
}

impl Transfers {
    pub fn import_finished(self: &Arc<Self>) {
        if self.importing.swap(true, Ordering::AcqRel) {
            return;
        }
        let jobs: Vec<Job> = self.entries().values().flat_map(|entry| jobs_of(self, entry)).collect();
        if jobs.is_empty() {
            self.importing.store(false, Ordering::Release);
            return;
        }
        let transfers = Arc::clone(self);
        tokio::spawn(async move {
            for job in jobs {
                transfers.import(job).await;
            }
            transfers.importing.store(false, Ordering::Release);
        });
    }

    async fn library_base(&self, title_id: &str) -> Option<PathBuf> {
        let settings = self.settings();
        match TitleId::parse(title_id).ok()? {
            TitleId::Title(id) => Some(naming::movie(&settings.movies_folder(), &self.titles.name(&id).await?)),
            TitleId::Episode { series, season, episode } => {
                let show = self.titles.name(&series).await?;
                let named = self.titles.name(title_id).await;
                let name = EpisodeName { series: &show, season, episode, title: named.as_ref().map(|named| named.title.as_str()) };
                Some(naming::episode(&settings.shows_folder(), &name))
            }
        }
    }

    async fn import(&self, job: Job) {
        let Some(base) = self.library_base(&job.title_id).await else { return };
        let info_hash = job.info_hash.clone();
        let index = job.video.index;
        let placed = tokio::task::spawn_blocking(move || place_job(&job, &base)).await;
        let links = match placed {
            Ok(Ok(links)) => links,
            Ok(Err(error)) => return self.import_failed(&info_hash, index, error.to_string()),
            Err(error) => return self.import_failed(&info_hash, index, error.to_string()),
        };
        let saved = {
            let mut entries = self.entries();
            match entries.get_mut(&info_hash) {
                Some(entry) => {
                    entry.library.extend(links);
                    Some(entry.library.clone())
                }
                None => {
                    let roots = library_roots(self.settings().download_dir());
                    links.iter().for_each(|link| unplace(&link.path, &roots));
                    None
                }
            }
        };
        if let Some(links) = saved {
            self.save_library(&info_hash, links).await;
        }
        self.emit_changes();
    }

    fn import_failed(&self, info_hash: &str, index: usize, error: String) {
        tracing::warn!(%info_hash, %error, "could not add a download to the library");
        if let Some(entry) = self.entries().get_mut(info_hash) {
            entry.import_failed.insert(index);
            entry.file_error = Some(format!("This download couldn't be added to the library: {error}."));
        }
    }

    pub async fn save_library(&self, info_hash: &str, links: Vec<LibraryLink>) {
        let hash = info_hash.to_owned();
        if let Err(error) = self.db.run(move |conn| super::store::save(conn, &hash, &links)).await {
            tracing::warn!(%error, "could not save library files");
        }
    }

    pub async fn unlink_library(links: Vec<LibraryLink>, download_dir: &Path) {
        if links.is_empty() {
            return;
        }
        let roots = library_roots(download_dir);
        let _ = tokio::task::spawn_blocking(move || links.iter().for_each(|link| unplace(&link.path, &roots))).await;
    }

    pub fn finished_path(&self, info_hash: &str, handle: &Handle, index: usize) -> watchit_core::AppResult<PathBuf> {
        let organised = self.entries().get(info_hash).and_then(|entry| {
            entry.library.iter().find(|link| link.file_index == index && link.path.is_file()).map(|link| link.path.clone())
        });
        organised.map_or_else(|| self.disk_path(handle, index), Ok)
    }
}
