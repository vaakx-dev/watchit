use std::path::PathBuf;

use watchit_core::{AppError, AppResult, Viewer};

use super::browse::absolute;
use crate::settings::Settings;

pub fn chosen_folder(viewer: &Viewer, requested: Option<&str>) -> AppResult<Option<PathBuf>> {
    let Some(value) = requested else { return Ok(None) };
    viewer.require_admin()?;
    let folder = absolute(value)?;
    std::fs::create_dir_all(&folder).map_err(|error| AppError::bad_request(format!("That folder can't be used: {error}.")))?;
    Ok(Some(folder))
}

pub fn require_admin_for_folders(viewer: &Viewer, current: &Settings, next: &Settings) -> AppResult<()> {
    let changed = current.download_dir != next.download_dir || current.movie_dir != next.movie_dir || current.series_dir != next.series_dir;
    if changed { viewer.require_admin() } else { Ok(()) }
}
