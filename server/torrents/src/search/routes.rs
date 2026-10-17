use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult, Viewer};

use super::TorrentResult;
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Deserialize)]
pub struct SearchQuery {
    title: String,
    #[serde(default)]
    unfiltered: bool,
    season: Option<u32>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/", rename = "TorrentSearch")]
pub struct SearchResponse {
    results: Vec<TorrentResult>,
    hidden: usize,
}

pub async fn search(State(torrents): State<Torrents>, viewer: Viewer, Query(query): Query<SearchQuery>) -> AppResult<Json<SearchResponse>> {
    let title = match (TitleId::parse(&query.title)?, query.season) {
        (TitleId::Title(series), Some(season)) => torrents.search().season_start(&series, season).await,
        (_, Some(_)) => return Err(AppError::bad_request("A season search needs a series id.")),
        (title, None) => title,
    };
    let quality = torrents.quality(viewer.profile).await?;
    let quality = if query.unfiltered { quality.without_filters() } else { quality };
    let found = torrents.search().ranked(&title, &quality).await?;
    Ok(Json(SearchResponse { results: found.candidates.into_iter().map(|candidate| candidate.result).collect(), hidden: found.hidden }))
}
