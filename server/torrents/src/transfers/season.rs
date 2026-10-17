use std::sync::Arc;

use watchit_core::{AppError, AppResult};

use super::Transfers;
use super::model::{Kind, Transfer};
use super::record::{Choice, Pick};
use crate::release::episode;
use crate::search::{Candidate, same_tier};
use crate::title_id::TitleId;

fn best_pack(found: &[Candidate], season: u32) -> Option<&Candidate> {
    let best = found.first()?;
    found.iter().filter(|candidate| same_tier(candidate, best)).find(|candidate| episode::coverage(&candidate.result.name).is_pack_for(season))
}

impl Transfers {
    pub async fn add_season(self: &Arc<Self>, series_id: &str, season: u32) -> AppResult<Vec<Transfer>> {
        let TitleId::Title(series) = TitleId::parse(series_id)? else {
            return Err(AppError::bad_request("A season download needs a series id."));
        };
        let episodes = self.titles.season_episodes(&series, season).await;
        let first = episodes.first().copied().unwrap_or(1);
        let found = self.search.ranked(&TitleId::episode(&series, season, first)).await?;
        if let Some(pack) = best_pack(&found, season) {
            let pick = Pick { title_id: series.clone(), choice: Choice::Season { season } };
            return Ok(vec![self.add(&pack.result.info_hash, pick, Kind::Download, false).await?]);
        }
        if episodes.is_empty() {
            return Err(AppError::not_found("No season pack was found and the season's episode list is unavailable."));
        }
        let mut added = Vec::new();
        for number in episodes {
            let title = TitleId::episode(&series, season, number);
            let results = if number == first { found.clone() } else { self.search.ranked(&title).await? };
            let Some(best) = results.first() else { continue };
            let pick = Pick::files_or(&title.to_string(), best.result.file_index.map(|index| vec![index]), Choice::Main);
            added.push(self.add(&best.result.info_hash, pick, Kind::Download, false).await?);
        }
        if added.is_empty() {
            return Err(AppError::not_found("No torrents were found for this season."));
        }
        Ok(added)
    }
}
