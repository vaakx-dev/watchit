use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::AppResult;

use super::TorrentResult;
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Deserialize)]
pub struct SearchQuery {
    title: String,
}

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/", rename = "TorrentSearch")]
pub struct SearchResponse {
    results: Vec<TorrentResult>,
}

pub async fn search(State(torrents): State<Torrents>, Query(query): Query<SearchQuery>) -> AppResult<Json<SearchResponse>> {
    let title = TitleId::parse(&query.title)?;
    let found = torrents.search().ranked(&title).await?;
    Ok(Json(SearchResponse { results: found.into_iter().map(|candidate| candidate.result).collect() }))
}
