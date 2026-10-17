use std::path::{Path, PathBuf};

use crate::settings::Settings;

const TORRENTS: &str = "Torrents";
const MOVIES: &str = "Movies";
const SHOWS: &str = "Shows";

pub fn library_roots(download_dir: &Path) -> [PathBuf; 2] {
    [download_dir.join(MOVIES), download_dir.join(SHOWS)]
}

impl Settings {
    pub fn torrents_folder(&self) -> PathBuf {
        self.download_dir.join(TORRENTS)
    }

    pub fn movies_folder(&self) -> PathBuf {
        self.download_dir.join(MOVIES)
    }

    pub fn shows_folder(&self) -> PathBuf {
        self.download_dir.join(SHOWS)
    }
}
