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
mod searches;
mod seasons;
mod shelves;
mod status;
mod titles;

use axum::Router;
use axum::routing::{delete, get, patch, post, put};
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
        Ok(Self {
            db: context.db.clone(),
            catalog,
        })
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
    [
        entries::TABLE,
        seasons::TABLE,
        progress::TABLE,
        playback_source::TABLE,
        searches::TABLE,
        rankings::duels::TABLE,
        rankings::system::TABLE,
    ]
    .concat()
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
        .route("/api/rankings/system", get(rankings::system::show).put(rankings::system::choose))
        .route("/api/rankings/duels", get(rankings::duels::next).post(rankings::duels::result))
        .route("/api/rankings/duels/skip", post(rankings::duels::skip))
        .route("/api/rankings/duels/undo", post(rankings::duels::undo))
        .route("/api/rankings/duels/ranked", get(rankings::duels::ranked))
        .route("/api/rankings/{id}", patch(rankings::place))
        .route("/api/progress/{id}", put(progress::save).delete(progress::clear))
        .route("/api/searches", get(searches::list).post(searches::remember).delete(searches::clear))
        .route("/api/searches/{query}", delete(searches::forget))
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
    rankings::system::RankingChoice::export_all(config)?;
    rankings::duels::DuelBoard::export_all(config)?;
    rankings::duels::DuelRanking::export_all(config)?;
    rankings::duels::DuelResult::export_all(config)?;
    rankings::duels::DuelPair::export_all(config)?;
    playback_source::PlaybackPreference::export_all(config)?;
    playback_source::SourcePatch::export_all(config)?;
    progress::ProgressSaved::export_all(config)?;
    searches::RecentSearches::export_all(config)?;
    searches::NewSearch::export_all(config)?;
    progress::Reading::export_all(config)
}
