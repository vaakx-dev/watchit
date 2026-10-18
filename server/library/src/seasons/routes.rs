use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use watchit_catalog::{MediaKind, is_imdb_id};
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use super::store;
use super::types::{SeasonPatch, SeasonResponse, SeasonWatched};
use crate::Library;
use crate::progress::series_progress;

fn season_number(segment: &str) -> AppResult<i64> {
    let valid = segment.bytes().all(|byte| byte.is_ascii_digit()) && !segment.is_empty() && (segment == "0" || !segment.starts_with('0'));
    segment
        .parse()
        .ok()
        .filter(|season| valid && *season <= 99_999)
        .ok_or_else(|| AppError::bad_request("Invalid season number."))
}

pub async fn update(
    State(library): State<Library>,
    viewer: Viewer,
    Path((series_id, season)): Path<(String, String)>,
    JsonBody(patch): JsonBody<SeasonPatch>,
) -> AppResult<Json<SeasonResponse>> {
    if !is_imdb_id(&series_id) {
        return Err(AppError::bad_request("Invalid series identifier."));
    }
    let season = season_number(&season)?;
    let single = patch.rating.is_some() != patch.watched.is_some();
    if !single {
        return Err(AppError::bad_request("Season patch must contain only a rating or a watched field."));
    }
    if library.title(&series_id).await?.kind != MediaKind::Series {
        return Err(AppError::not_found("Series catalog entry not found."));
    }
    let profile = viewer.profile;
    if let Some(watched) = patch.watched {
        let (catalog, id) = (library.catalog.clone(), series_id.clone());
        library
            .db
            .run(move |conn| {
                if catalog.episodes_pending(conn, &id)? {
                    return Err(
                        AppError::new(StatusCode::CONFLICT, "Episodes for this season are still importing. Try again shortly.").retry_after(2),
                    );
                }
                store::mark_watched(conn, &catalog, profile, &id, season, watched)
            })
            .await?;
        let snapshot = library.snapshot(profile).await?;
        let (catalog, id) = (library.catalog.clone(), series_id);
        let progress = library.db.run(move |conn| series_progress(conn, &catalog, profile, &id)).await?;
        return Ok(Json(SeasonResponse::Watched(Box::new(SeasonWatched { snapshot, progress }))));
    }
    let rating = patch.rating.flatten();
    library.db.run(move |conn| store::rate(conn, profile, &series_id, season, rating)).await?;
    library.snapshot(profile).await.map(|snapshot| Json(SeasonResponse::Rated(snapshot)))
}
