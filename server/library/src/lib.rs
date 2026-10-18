mod clock;
mod entries;
mod hidden;
mod ids;
mod personal;
mod playback_source;
mod present;
mod progress;
mod query;
mod rankings;
mod rating;
mod seasons;
mod shelves;
mod status;
mod titles;

use axum::Router;
use axum::routing::{get, patch, put};
use ts_rs::{Config, ExportError, TS};
use watchit_catalog::Catalog;
use watchit_core::{AppError, AppResult, Context, Db};

pub use rating::Rating;
pub use status::Status;

#[derive(Clone)]
pub struct Library {
    db: Db,
    catalog: Catalog,
}

impl Library {
    pub fn open(context: &Context, catalog: Catalog) -> AppResult<Self> {
        context.db.run_blocking(|conn| Ok(conn.execute_batch(&tables())?))?;
        Ok(Self { db: context.db.clone(), catalog })
    }

    pub(crate) async fn title(&self, id: &str) -> AppResult<titles::TitleRef> {
        let (catalog, id) = (self.catalog.clone(), id.to_owned());
        self.db
            .run(move |conn| match catalog.kind(conn, &id)? {
                Some(kind) => Ok(titles::TitleRef::new(&id, kind)),
                None => {
                    catalog.import_title(conn, &id)?;
                    Err(AppError::not_found("This title has not been imported into the local catalog."))
                }
            })
            .await
    }
}

fn tables() -> String {
    [entries::TABLE, seasons::TABLE, progress::TABLE, playback_source::TABLE].concat()
}

pub fn router(library: Library) -> Router {
    Router::new()
        .route("/api/library", get(entries::snapshot))
        .route("/api/library/titles", get(shelves::page))
        .route("/api/library/continue", get(shelves::continuing))
        .route("/api/library/{id}", patch(entries::update))
        .route("/api/library/{id}/seasons/{season}", patch(seasons::update))
        .route("/api/library/{id}/playback", patch(playback_source::update))
        .route("/api/rankings", get(rankings::show))
        .route("/api/rankings/unrated", get(rankings::unrated))
        .route("/api/rankings/{id}", patch(rankings::place))
        .route("/api/progress/{id}", put(progress::save).delete(progress::clear))
        .with_state(library)
}

pub fn export_types(config: &Config) -> Result<(), ExportError> {
    entries::LibrarySnapshot::export_all(config)?;
    entries::PersonalPatch::export_all(config)?;
    seasons::SeasonPatch::export_all(config)?;
    seasons::SeasonWatched::export_all(config)?;
    shelves::LibraryPage::export_all(config)?;
    shelves::ContinuePage::export_all(config)?;
    rankings::Rankings::export_all(config)?;
    rankings::RankingMove::export_all(config)?;
    rankings::UnratedTitles::export_all(config)?;
    playback_source::PlaybackPreference::export_all(config)?;
    playback_source::SourcePatch::export_all(config)?;
    progress::ProgressSaved::export_all(config)?;
    progress::Reading::export_all(config)
}
