use axum::Json;
use axum::extract::{Query, State};
use rusqlite::Connection;
use serde_json::{Map, Value};
use watchit_artwork::{Artwork, ImageSettings, ImageSettingsPatch};
use watchit_core::{AppError, AppResult, JsonBody, Viewer};

use crate::model::{CacheSettings, CacheStatus, CatalogResponse, ImportStatus, TrendingResponse};
use crate::routes::params::Params;
use crate::service::Catalog;
use crate::settings::MetadataHours;
use crate::store::browse::{BrowseQuery, IdFilter, browse};
use crate::store::trending;

impl Catalog {
    pub(crate) fn hidden(&self, conn: &Connection, viewer: Viewer, statuses: &[String]) -> AppResult<Option<IdFilter>> {
        if statuses.is_empty() {
            return Ok(None);
        }
        let ids = match self.personal() {
            Some(personal) => personal.hidden(conn, viewer.profile, statuses)?,
            None => Vec::new(),
        };
        Ok(Some(IdFilter::Exclude(ids)))
    }

    fn cache_status(&self, conn: &Connection) -> AppResult<CacheStatus> {
        let images = Artwork::usage(conn)?;
        let metadata_count = conn.query_row("SELECT COUNT(*) FROM titles", [], |row| row.get(0))?;
        let ImageSettings { images_days, max_stale_days, image_limit_mb } = self.inner.artwork.settings();
        Ok(CacheStatus {
            settings: CacheSettings { metadata_hours: self.inner.metadata.hours(), images_days, max_stale_days, image_limit_mb },
            image_bytes: images.image_bytes,
            image_count: images.image_count,
            metadata_count,
        })
    }
}

pub(crate) async fn list(State(catalog): State<Catalog>, viewer: Viewer, Query(params): Query<Vec<(String, String)>>) -> AppResult<Json<CatalogResponse>> {
    let params = Params(params);
    let query = BrowseQuery { page: params.page()?, query: params.query()?, kind: params.kind()?, genre: params.genre()?, sort: params.sort()? };
    let hide = params.hide()?;
    let response = catalog
        .inner
        .db
        .run({
            let catalog = catalog.clone();
            move |conn| {
                let inner = &catalog.inner;
                let filter = catalog.hidden(conn, viewer, &hide)?;
                let page = browse(conn, &inner.artwork, &inner.facets, &query, filter.as_ref(), inner.metadata.ms())?;
                for item in page.items.iter().filter(|item| item.artwork.is_empty()) {
                    inner.sync.title(conn, &item.id)?;
                }
                let imports = inner.sync.catalog(conn, &query, page.items.is_empty())?;
                Ok(CatalogResponse { page, imports })
            }
        })
        .await?;
    Ok(Json(response))
}

pub(crate) async fn trending_list(
    State(catalog): State<Catalog>,
    viewer: Viewer,
    Query(params): Query<Vec<(String, String)>>,
) -> AppResult<Json<TrendingResponse>> {
    let params = Params(params);
    let (kind, page, hide) = (params.kind()?, params.page()?, params.hide()?);
    let response = catalog
        .inner
        .db
        .run({
            let catalog = catalog.clone();
            move |conn| {
                let filter = catalog.hidden(conn, viewer, &hide)?;
                let page = trending::page(conn, &catalog.inner.artwork, kind, page, filter.as_ref())?;
                Ok(TrendingResponse { page, imports: catalog.inner.sync.trending(kind) })
            }
        })
        .await?;
    Ok(Json(response))
}

pub(crate) async fn imports(State(catalog): State<Catalog>) -> Json<ImportStatus> {
    Json(catalog.inner.sync.status())
}

pub(crate) async fn cache(State(catalog): State<Catalog>) -> AppResult<Json<CacheStatus>> {
    let status = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| catalog.cache_status(conn)
    });
    Ok(Json(status.await?))
}

pub(crate) async fn update_cache(State(catalog): State<Catalog>, JsonBody(body): JsonBody<Map<String, Value>>) -> AppResult<Json<CacheStatus>> {
    let mut metadata_hours = None;
    let mut images = ImageSettingsPatch::default();
    for (key, value) in &body {
        let known = key == "metadata_hours" || ImageSettings::KEYS.contains(&key.as_str());
        if !known {
            return Err(AppError::bad_request(format!("Unknown cache setting: {key}.")));
        }
        let Some(number) = value.as_f64().filter(|number| number.is_finite()) else {
            return Err(AppError::bad_request(format!("{key} must be a finite number.")));
        };
        if key == "metadata_hours" {
            MetadataHours::validate(number)?;
            metadata_hours = Some(number);
        } else {
            images.set(key, number);
        }
    }
    images.validate()?;
    let status = catalog.inner.db.run({
        let catalog = catalog.clone();
        move |conn| {
            let transaction = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
            catalog.inner.artwork.update_settings(&transaction, &images)?;
            if let Some(hours) = metadata_hours {
                catalog.inner.metadata.set(&transaction, hours)?;
            }
            transaction.commit()?;
            catalog.cache_status(conn)
        }
    });
    Ok(Json(status.await?))
}
