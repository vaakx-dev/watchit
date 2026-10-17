use std::path::PathBuf;

use crate::settings::Settings;
use crate::title_id::TitleId;
use crate::transfers::model::Kind;
use crate::transfers::{Choice, Pick};

pub fn is_series_pick(pick: &Pick) -> bool {
    matches!(pick.choice, Choice::Season { .. }) || is_series_title(&pick.title_id)
}

pub fn is_series_title(title_id: &str) -> bool {
    TitleId::parse(title_id).is_ok_and(|title| title.is_episode())
}

impl Settings {
    pub fn folder_for(&self, kind: Kind, series: bool) -> PathBuf {
        let specific = match kind {
            Kind::Stream => None,
            Kind::Download if series => self.series_dir.as_ref(),
            Kind::Download => self.movie_dir.as_ref(),
        };
        specific.unwrap_or(&self.download_dir).clone()
    }
}
