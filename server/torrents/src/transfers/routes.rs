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
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use super::control::Change;
use super::model::{Kind, Transfer};
use super::record::{Choice, Pick};
use super::{SeasonRequest, TransferEvent};
use crate::bandwidth::SpeedStatus;
use crate::locations::{Disk, chosen_folder};
use crate::service::Torrents;
use crate::title_id::TitleId;

#[derive(Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct TransferList {
    transfers: Vec<Transfer>,
    disks: Vec<Disk>,
    speed: SpeedStatus,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct NewTransfer {
    info_hash: String,
    file_indexes: Option<Vec<usize>>,
    title_id: String,
    kind: Kind,
    #[serde(default)]
    #[ts(optional)]
    notify_when_ready: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    download_dir: Option<String>,
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/")]
pub struct SeasonDownload {
    series_id: String,
    season: u32,
    #[serde(default)]
    #[ts(optional)]
    info_hash: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    notify_when_ready: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    download_dir: Option<String>,
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
    #[serde(default)]
    #[ts(optional)]
    notify_when_ready: Option<bool>,
    #[serde(default)]
    #[ts(optional)]
    queue_position: Option<u32>,
    #[serde(default)]
    #[ts(optional)]
    download_dir: Option<String>,
}

#[derive(Deserialize)]
pub struct DeleteQuery {
    #[serde(default)]
    delete_files: bool,
}

pub async fn list(State(torrents): State<Torrents>) -> AppResult<Json<TransferList>> {
    let transfers = torrents.transfers().await?;
    Ok(Json(TransferList { transfers: transfers.all(), disks: transfers.disks(), speed: transfers.bandwidth.status() }))
}

pub async fn create(State(torrents): State<Torrents>, viewer: Viewer, JsonBody(body): JsonBody<NewTransfer>) -> AppResult<Json<Transfer>> {
    let folder = chosen_folder(&viewer, body.download_dir.as_deref())?;
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
    transfers.add(&body.info_hash, pick, body.kind, folder, body.notify_when_ready.unwrap_or(false)).await.map(Json)
}

pub async fn season(
    State(torrents): State<Torrents>,
    viewer: Viewer,
    JsonBody(body): JsonBody<SeasonDownload>,
) -> AppResult<Json<Vec<Transfer>>> {
    let folder = chosen_folder(&viewer, body.download_dir.as_deref())?;
    let quality = torrents.quality(viewer.profile).await?;
    let transfers = torrents.transfers().await?;
    let request = SeasonRequest {
        series: body.series_id,
        season: body.season,
        info_hash: body.info_hash,
        folder,
        quality,
        notify_when_ready: body.notify_when_ready.unwrap_or(false),
    };
    transfers.add_season(request).await.map(Json)
}

pub async fn update(
    State(torrents): State<Torrents>,
    viewer: Viewer,
    Path(id): Path<String>,
    JsonBody(body): JsonBody<TransferPatch>,
) -> AppResult<Json<Transfer>> {
    if body.kind == Some(Kind::Stream) {
        return Err(AppError::bad_request("A transfer can only be changed into a download."));
    }
    let folder = chosen_folder(&viewer, body.download_dir.as_deref())?;
    let transfers = torrents.transfers().await?;
    if let Some(folder) = folder {
        transfers.relocate(&id, folder).await?;
    }
    transfers.change(&id, Change { paused: body.paused, kind: body.kind, queue_position: body.queue_position, notify_when_ready: body.notify_when_ready }).await.map(Json)
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
        TransferEvent::Ready(notice) => Event::default().event("ready").json_data(notice).ok(),
        TransferEvent::Speed(status) => Event::default().event("speed").json_data(status).ok(),
    }
}

pub async fn events(State(torrents): State<Torrents>) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let transfers = torrents.transfers().await?;
    let stopping = torrents.stopping();
    let live = BroadcastStream::new(transfers.subscribe()).filter_map(|event| future::ready(event.ok()));
    let speed = TransferEvent::Speed(transfers.bandwidth.status());
    let current = futures::stream::iter(transfers.all().into_iter().map(|transfer| TransferEvent::Changed(Box::new(transfer))).chain([speed]));
    let stream = current
        .chain(live)
        .filter_map(|event| future::ready(sse_event(event).map(Ok)))
        .take_until(stopping);
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
