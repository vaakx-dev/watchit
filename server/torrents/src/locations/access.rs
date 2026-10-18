use watchit_core::{AppResult, Viewer};

use crate::settings::Settings;

pub fn require_admin_for_folders(viewer: &Viewer, current: &Settings, next: &Settings) -> AppResult<()> {
    if current.download_dir != next.download_dir {
        viewer.require_admin()
    } else {
        Ok(())
    }
}
