use axum::Json;
use axum::extract::State;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_catalog::SavedPosition;
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use super::rules::{Outcome, classify};
use super::store;
use crate::Library;
use crate::entries::{self, PersonalEntry, PersonalPatch};
use crate::ids::TitleId;
use crate::status::Status;

const LONGEST_SECONDS: f64 = 7.0 * 86_400.0;

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct Reading {
    pub position_seconds: f64,
    pub duration_seconds: f64,
}

#[derive(Serialize, TS)]
#[ts(export_to = "library/")]
pub struct ProgressSaved {
    pub resume: Option<SavedPosition>,
    pub entry: PersonalEntry,
}

impl Reading {
    fn checked(&self) -> AppResult<(f64, f64)> {
        let duration = self.duration_seconds;
        if !duration.is_finite() || duration <= 0.0 || duration > LONGEST_SECONDS {
            return Err(AppError::bad_request("duration_seconds must be a positive number of seconds."));
        }
        if !self.position_seconds.is_finite() || self.position_seconds < 0.0 {
            return Err(AppError::bad_request("position_seconds must be zero or more."));
        }
        Ok((self.position_seconds.min(duration), duration))
    }
}

pub async fn save(
    State(library): State<Library>,
    viewer: Viewer,
    TitleId(id): TitleId,
    JsonBody(reading): JsonBody<Reading>,
) -> AppResult<Json<ProgressSaved>> {
    let (position, duration) = reading.checked()?;
    let title = library.title(&id).await?;
    let outcome = classify(position, duration);
    let saved = library
        .db
        .run(move |conn| {
            let mut patch = PersonalPatch { opened: Some(true), ..PersonalPatch::default() };
            match outcome {
                Outcome::Watched => patch.status = Some(Some(Status::Watched)),
                Outcome::Resume => store::put(conn, viewer.profile, &id, position, duration)?,
                Outcome::Clear => store::forget(conn, viewer.profile, &id)?,
            }
            entries::apply(conn, viewer.profile, &id, &title, &patch)?;
            Ok(ProgressSaved { resume: store::get(conn, viewer.profile, &id)?, entry: entries::entry(conn, viewer.profile, &id)? })
        })
        .await?;
    Ok(Json(saved))
}

pub async fn clear(State(library): State<Library>, viewer: Viewer, TitleId(id): TitleId) -> AppResult<Json<ProgressSaved>> {
    let saved = library
        .db
        .run(move |conn| {
            store::forget(conn, viewer.profile, &id)?;
            Ok(ProgressSaved { resume: None, entry: entries::entry(conn, viewer.profile, &id)? })
        })
        .await?;
    Ok(Json(saved))
}
