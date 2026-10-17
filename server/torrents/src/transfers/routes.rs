use std::convert::Infallible;

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::{Stream, StreamExt, future};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_stream::wrappers::BroadcastStream;
use ts_rs::TS;
use watchit_core::{AppError, AppResult, JsonBody};

use super::control::Change;
use super::model::{Kind, Transfer};
use super::record::{Choice, Pick};
use super::{Disk, TransferEvent};
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct TransferList {
    transfers: Vec<Transfer>,
    disk: Disk,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct NewTransfer {
    info_hash: String,
    file_indexes: Option<Vec<usize>>,
    title_id: String,
    kind: Kind,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct SeasonDownload {
    series_id: String,
    season: u32,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct TransferPatch {
    #[serde(default)]
    #[ts(optional)]
    paused: Option<bool>,
    #[serde(default)]
    #[ts(optional, type = "'download'")]
    kind: Option<Kind>,
}

#[derive(Deserialize)]
pub struct DeleteQuery {
    #[serde(default)]
    delete_files: bool,
}

pub async fn list(State(torrents): State<Torrents>) -> AppResult<Json<TransferList>> {
    let transfers = torrents.transfers().await?;
    Ok(Json(TransferList { transfers: transfers.all(), disk: transfers.disk() }))
}

pub async fn create(State(torrents): State<Torrents>, JsonBody(body): JsonBody<NewTransfer>) -> AppResult<Json<Transfer>> {
    let title = TitleId::parse(&body.title_id)?.to_string();
    if body.file_indexes.as_ref().is_some_and(Vec::is_empty) {
        return Err(AppError::bad_request("Pick at least one file, or send null for the whole torrent."));
    }
    let fallback = match body.kind {
        Kind::Stream => Choice::Main,
        Kind::Download => Choice::All,
    };
    let pick = Pick::files_or(&title, body.file_indexes, fallback);
    let transfers = torrents.transfers().await?;
    transfers.add(&body.info_hash, pick, body.kind).await.map(Json)
}

pub async fn season(State(torrents): State<Torrents>, JsonBody(body): JsonBody<SeasonDownload>) -> AppResult<Json<Vec<Transfer>>> {
    let transfers = torrents.transfers().await?;
    transfers.add_season(&body.series_id, body.season).await.map(Json)
}

pub async fn update(
    State(torrents): State<Torrents>,
    Path(id): Path<String>,
    JsonBody(body): JsonBody<TransferPatch>,
) -> AppResult<Json<Transfer>> {
    if body.kind == Some(Kind::Stream) {
        return Err(AppError::bad_request("A transfer can only be changed into a download."));
    }
    let transfers = torrents.transfers().await?;
    transfers.change(&id, Change { paused: body.paused, kind: body.kind }).await.map(Json)
}

pub async fn remove(State(torrents): State<Torrents>, Path(id): Path<String>, Query(query): Query<DeleteQuery>) -> AppResult<StatusCode> {
    let transfers = torrents.transfers().await?;
    transfers.remove(&id, query.delete_files).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn sse_event(event: TransferEvent) -> Option<Event> {
    match event {
        TransferEvent::Changed(transfer) => Event::default().event("transfer").json_data(transfer).ok(),
        TransferEvent::Removed { id } => Event::default().event("removed").json_data(json!({ "id": id })).ok(),
    }
}

pub async fn events(State(torrents): State<Torrents>) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let transfers = torrents.transfers().await?;
    let stopping = torrents.stopping();
    let live = BroadcastStream::new(transfers.subscribe()).filter_map(|event| future::ready(event.ok()));
    let current = futures::stream::iter(transfers.all().into_iter().map(TransferEvent::Changed));
    let stream = current
        .chain(live)
        .filter_map(|event| future::ready(sse_event(event).map(Ok)))
        .take_until(stopping);
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
