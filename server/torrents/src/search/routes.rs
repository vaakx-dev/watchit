use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppResult, Viewer};

use super::TorrentResult;
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Deserialize)]
pub struct SearchQuery {
    title: String,
    #[serde(default)]
    unfiltered: bool,
}

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/", rename = "TorrentSearch")]
pub struct SearchResponse {
    results: Vec<TorrentResult>,
    hidden: usize,
}

pub async fn search(State(torrents): State<Torrents>, viewer: Viewer, Query(query): Query<SearchQuery>) -> AppResult<Json<SearchResponse>> {
    let title = TitleId::parse(&query.title)?;
    let quality = torrents.quality(viewer.profile).await?;
    let quality = if query.unfiltered { quality.without_filters() } else { quality };
    let found = torrents.search().ranked(&title, &quality).await?;
    Ok(Json(SearchResponse { results: found.candidates.into_iter().map(|candidate| candidate.result).collect(), hidden: found.hidden }))
}
