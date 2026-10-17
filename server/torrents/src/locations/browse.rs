use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

use super::volume;

#[derive(Debug, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct FolderListing {
    pub path: Option<String>,
    pub parent: Option<String>,
    pub folders: Vec<FolderEntry>,
    pub free_bytes: Option<u64>,
}

fn text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub fn absolute(value: &str) -> AppResult<PathBuf> {
    let path: PathBuf = Path::new(value.trim()).components().collect();
    let clean = path.is_absolute() && !path.components().any(|part| matches!(part, Component::ParentDir | Component::CurDir));
    if clean { Ok(path) } else { Err(AppError::bad_request("Enter a full folder path, such as D:\\Movies.")) }
}

fn drives() -> FolderListing {
    let folders = volume::drives().into_iter().map(|drive| FolderEntry { name: text(&drive), path: text(&drive) }).collect();
    FolderListing { path: None, parent: None, folders, free_bytes: None }
}

fn folders_in(path: &Path) -> AppResult<Vec<FolderEntry>> {
    let reader = std::fs::read_dir(path).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => AppError::not_found("That folder doesn't exist."),
        _ => AppError::bad_request(format!("That folder can't be opened: {error}.")),
    })?;
    let mut folders: Vec<FolderEntry> = reader
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter(|entry| !volume::is_hidden(&entry.path()))
        .map(|entry| FolderEntry { name: entry.file_name().to_string_lossy().into_owned(), path: text(&entry.path()) })
        .collect();
    folders.sort_by_key(|folder| folder.name.to_lowercase());
    Ok(folders)
}

pub fn browse(requested: Option<&str>) -> AppResult<FolderListing> {
    let Some(value) = requested.filter(|value| !value.trim().is_empty()) else { return Ok(drives()) };
    let path = absolute(value)?;
    let folders = folders_in(&path)?;
    Ok(FolderListing {
        parent: path.parent().map(text),
        free_bytes: fs4::available_space(&path).ok(),
        path: Some(text(&path)),
        folders,
    })
}
