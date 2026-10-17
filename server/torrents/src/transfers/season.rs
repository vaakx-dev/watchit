use std::sync::Arc;

use watchit_core::{AppError, AppResult};

use super::Transfers;
use super::model::{Kind, Transfer};
use super::record::{Choice, Pick};
use crate::quality::Quality;
use crate::search::Candidate;
use crate::title_id::TitleId;

pub struct SeasonRequest {
    pub series: String,
    pub season: u32,
    pub info_hash: Option<String>,
    pub notify_when_ready: bool,
    pub quality: Quality,
}

fn best_pack(found: &[Candidate]) -> Option<&Candidate> {
    found
        .iter()
        .filter(|candidate| candidate.result.seeders.is_none_or(|seeders| seeders > 0))
        .find(|candidate| candidate.result.season_pack)
}

impl Transfers {
    pub async fn add_season(self: &Arc<Self>, request: SeasonRequest) -> AppResult<Vec<Transfer>> {
        let TitleId::Title(series) = TitleId::parse(&request.series)? else {
            return Err(AppError::bad_request("A season download needs a series id."));
        };
        let SeasonRequest { season, notify_when_ready, quality, .. } = request;
        let pack = |info_hash: String| {
            let pick = Pick { title_id: series.clone(), choice: Choice::Season { season } };
            async move { self.add(&info_hash, pick, Kind::Download, notify_when_ready).await.map(|transfer| vec![transfer]) }
        };
        if let Some(info_hash) = request.info_hash {
            return pack(info_hash).await;
        }
        let episodes = self.titles.season_episodes(&series, season).await;
        let first = episodes.first().copied().unwrap_or(1);
        let found = self.search.ranked(&TitleId::episode(&series, season, first), &quality).await?.candidates;
        if let Some(best) = best_pack(&found) {
            return pack(best.result.info_hash.clone()).await;
        }
        if episodes.is_empty() {
            return Err(AppError::not_found("No season pack was found and the season's episode list is unavailable."));
        }
        let mut added = Vec::new();
        for number in episodes {
            let title = TitleId::episode(&series, season, number);
            let results = if number == first { found.clone() } else { self.search.ranked(&title, &quality).await?.candidates };
            let Some(best) = results.first() else { continue };
            let pick = Pick::files_or(&title.to_string(), best.result.file_index.map(|index| vec![index]), Choice::Main);
            added.push(self.add(&best.result.info_hash, pick, Kind::Download, notify_when_ready).await?);
        }
        if added.is_empty() {
            return Err(AppError::not_found("No torrents were found for this season."));
        }
        Ok(added)
    }
}
