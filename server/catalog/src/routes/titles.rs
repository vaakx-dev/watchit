use std::collections::HashSet;

use axum::Json;
use axum::extract::{Path, Query, State};
use rusqlite::Connection;
use watchit_core::{AppError, AppResult, Viewer};

use crate::clock::iso;
use crate::model::{EpisodesResponse, Freshness, MediaKind, NavigationResponse, RelatedTitles, TitleResult};
use crate::routes::params::{Params, title_id};
use crate::service::Catalog;
use crate::store::record::{Record, detail_fresh, load};
use crate::store::titles::{stored, view};
use crate::store::episodes;

fn not_imported() -> AppError {
    AppError::not_found("This title has not been imported into the local catalog.")
}

impl Catalog {
    fn imported(&self, conn: &Connection, id: &str) -> AppResult<Record> {
        match load(conn, id)? {
            Some(record) => Ok(record),
            None => {
                self.inner.sync.title(conn, id)?;
                Err(not_imported())
            }
        }
    }

    fn title_result(&self, conn: &Connection, viewer: Viewer, id: &str) -> AppResult<TitleResult> {
        let inner = &self.inner;
        let Some(stored) = stored(conn, id)? else {
            inner.sync.title(conn, id)?;
            return Err(not_imported());
        };
        let keys: Vec<_> = stored.poster.iter().cloned().collect();
        let images = inner.artwork.lookup(conn, &keys)?;
        let mut title = view(&stored, &images);
        title.provider_ids = inner.providers.ids(id)?;
        let freshness = Freshness {
            updated_at: if stored.updated_at > 0 { iso(stored.updated_at) } else { String::new() },
            stale: !detail_fresh(conn, id, false, inner.metadata.ms())?,
        };
        let imports = inner.sync.title(conn, id)?;
        let series_id = match title.entry.kind {
            MediaKind::Series => Some(title.entry.id.as_str()),
            MediaKind::Episode => title.series.as_ref().map(|series| series.id.as_str()),
            MediaKind::Movie => None,
        };
        let extras = match self.personal() {
            Some(personal) => personal.title(conn, viewer.profile, &title)?,
            None => self.default_extras(conn, series_id)?,
        };
        Ok(TitleResult {
            title,
            freshness,
            playback_source: extras.playback_source,
            progress: extras.progress,
            resume: extras.resume,
            imports,
            artwork_status: images.status,
        })
    }
}

pub(crate) async fn title(State(catalog): State<Catalog>, viewer: Viewer, Path(id): Path<String>) -> AppResult<Json<TitleResult>> {
    let id = title_id(&id)?;
    let result = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| catalog.title_result(conn, viewer, &id)
    });
    Ok(Json(result.await?))
}

pub(crate) async fn episode_list(
    State(catalog): State<Catalog>,
    Path(id): Path<String>,
    Query(params): Query<Vec<(String, String)>>,
) -> AppResult<Json<EpisodesResponse>> {
    let id = title_id(&id)?;
    let page = Params(params).page()?;
    let response = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| {
            let inner = &catalog.inner;
            if catalog.imported(conn, &id)?.kind != MediaKind::Series {
                return Err(AppError::bad_request("Episodes are only available for a series."));
            }
            let page = episodes::page(conn, &inner.artwork, &id, page, inner.metadata.ms())?;
            Ok(EpisodesResponse { page, imports: inner.sync.episodes(conn, &id)? })
        }
    });
    Ok(Json(response.await?))
}

pub(crate) async fn navigation(
    State(catalog): State<Catalog>,
    Path(id): Path<String>,
    Query(params): Query<Vec<(String, String)>>,
) -> AppResult<Json<NavigationResponse>> {
    let id = title_id(&id)?;
    let params = Params(params);
    let (season, page) = (params.season()?, params.optional_page()?);
    let response = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| {
            let inner = &catalog.inner;
            if catalog.imported(conn, &id)?.kind != MediaKind::Episode {
                return Err(AppError::bad_request("Episode navigation is only available for an episode."));
            }
            let navigation = episodes::navigation(conn, &inner.artwork, &id, season, page, inner.metadata.ms())?
                .ok_or_else(|| AppError::not_found("This episode has no local navigation."))?;
            Ok(NavigationResponse { navigation, imports: inner.sync.title(conn, &id)? })
        }
    });
    Ok(Json(response.await?))
}

pub(crate) async fn related(State(catalog): State<Catalog>, viewer: Viewer, Path(id): Path<String>) -> AppResult<Json<RelatedTitles>> {
    let id = title_id(&id)?;
    let response = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| {
            let title = catalog.imported(conn, &id)?;
            let settled: HashSet<String> = match catalog.personal() {
                Some(personal) => personal.settled(conn, viewer.profile)?.into_iter().collect(),
                None => HashSet::new(),
            };
            catalog.related(conn, &title, &settled)
        }
    });
    Ok(Json(response.await?))
}
