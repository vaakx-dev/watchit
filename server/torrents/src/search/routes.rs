use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

use super::TorrentResult;
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Deserialize)]
pub struct SearchQuery {
    title: String,
    season: Option<u32>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/", rename = "TorrentSearch")]
pub struct SearchResponse {
    results: Vec<TorrentResult>,
}

pub async fn search(State(torrents): State<Torrents>, Query(query): Query<SearchQuery>) -> AppResult<Json<SearchResponse>> {
    let title = match (TitleId::parse(&query.title)?, query.season) {
        (TitleId::Title(series), Some(season)) => torrents.search().season_start(&series, season).await,
        (_, Some(_)) => return Err(AppError::bad_request("A season search needs a series id.")),
        (title, None) => title,
    };
    let found = torrents.search().ranked(&title).await?;
    Ok(Json(SearchResponse { results: found.into_iter().map(|candidate| candidate.result).collect() }))
}
