use axum::Json;
use axum::extract::{Path, State};
use serde::Serialize;
use ts_rs::TS;
use watchit_core::AppResult;

use super::{LocalFile, local_files};
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct LocalFiles {
    files: Vec<LocalFile>,
}

pub async fn files(State(torrents): State<Torrents>, Path(title_id): Path<String>) -> AppResult<Json<LocalFiles>> {
    let title = TitleId::parse(&title_id)?.to_string();
    let transfers = torrents.transfers().await?;
    Ok(Json(LocalFiles { files: local_files(&transfers, &title) }))
}
