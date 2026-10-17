use std::collections::HashSet;

use crate::cinemeta::source::SourceQuery;
use crate::model::{CatalogKind, MediaKind};
use crate::store::{record, trending};
use crate::sync::Inner;
use crate::sync::jobs::{Job, Work};
use crate::sync::publish::{Filters, Published, StepError};

const TRENDING_PAGES: u32 = 10;

pub(crate) struct Step {
    pub ended: bool,
    pub published: Vec<String>,
}

fn trending_ids(items: &[Published], kind: CatalogKind) -> Vec<String> {
    let listed: Vec<&Published> = items.iter().filter(|item| kind != CatalogKind::Anime || item.anime).collect();
    let series: Vec<&str> = listed.iter().filter(|item| item.kind == MediaKind::Series).map(|item| item.id.as_str()).collect();
    let movies: Vec<&str> = listed.iter().filter(|item| item.kind == MediaKind::Movie).map(|item| item.id.as_str()).collect();
    let mut ids = Vec::with_capacity(listed.len());
    for index in 0..series.len().max(movies.len()) {
        ids.extend(series.get(index).map(|id| id.to_string()));
        ids.extend(movies.get(index).map(|id| id.to_string()));
    }
    ids
}

impl Inner {
    pub(crate) async fn step(&self, job: &mut Job) -> Result<Step, StepError> {
        if job.complete {
            job.page = 1;
            job.complete = false;
            match &mut job.work {
                Work::Catalog { previous, details, has_next, .. } => {
                    previous.clear();
                    details.clear();
                    *has_next = false;
                }
                Work::Trending { ids, .. } => ids.clear(),
                Work::Title { .. } | Work::Episodes { .. } => {}
            }
        }
        match job.work.clone() {
            Work::Catalog { .. } => self.catalog_step(job).await,
            Work::Trending { kind, .. } => self.trending_step(job, kind).await,
            Work::Title { id, kind } => self.detail_step(job, id, kind, false).await,
            Work::Episodes { id } => self.detail_step(job, id, Some(MediaKind::Series), true).await,
        }
    }

    async fn catalog_step(&self, job: &mut Job) -> Result<Step, StepError> {
        let page = job.page;
        let Work::Catalog { query, previous, details, has_next, .. } = &mut job.work else { unreachable!() };
        if let Some(id) = details.pop_front() {
            let mut published = Vec::new();
            if !self.fresh(&id, false).await? {
                match self.source.title(&id, self.known_kind(&id).await?).await {
                    Ok(meta) => published = self.publish_detail(meta, id).await?,
                    Err(error) if error.status == 404 => {}
                    Err(error) => {
                        details.push_front(id);
                        return Err(error.into());
                    }
                }
            }
            let ended = details.is_empty();
            if ended {
                job.complete = !*has_next;
                job.page += 1;
            }
            return Ok(Step { ended, published });
        }
        let seen: HashSet<String> = previous.iter().cloned().collect();
        let result = self.source.catalog(query, page, &seen).await?;
        let filters = Filters { anime: query.kind == CatalogKind::Anime && !query.query.is_empty(), genre: !query.genre.is_empty() && !query.query.is_empty() };
        let items = self.publish_catalog(result.metas, filters).await?;
        *previous = items.iter().map(|item| item.id.clone()).collect();
        details.extend(items.iter().filter(|item| item.needs_detail).map(|item| item.id.clone()));
        *has_next = result.has_next;
        let ended = details.is_empty();
        if ended {
            job.complete = !result.has_next;
            job.page += 1;
        }
        Ok(Step { ended, published: Vec::new() })
    }

    async fn trending_step(&self, job: &mut Job, kind: CatalogKind) -> Result<Step, StepError> {
        let page = job.page;
        let Work::Trending { ids, .. } = &mut job.work else { unreachable!() };
        let query = SourceQuery { kind, query: String::new(), genre: String::new() };
        let seen: HashSet<String> = ids.iter().cloned().collect();
        let result = self.source.catalog(&query, page, &seen).await?;
        let items = self.publish_catalog(result.metas, Filters { anime: false, genre: false }).await?;
        ids.extend(trending_ids(&items, kind));
        if result.has_next && page < TRENDING_PAGES {
            job.page += 1;
            return Ok(Step { ended: false, published: Vec::new() });
        }
        let mut unique = HashSet::new();
        let ranked: Vec<String> = ids.iter().filter(|id| unique.insert(id.as_str())).cloned().collect();
        self.db.run(move |conn| {
            let transaction = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
            trending::save(&transaction, kind, &ranked)?;
            Ok(transaction.commit()?)
        })
        .await?;
        job.complete = true;
        Ok(Step { ended: true, published: Vec::new() })
    }

    async fn detail_step(&self, job: &mut Job, id: String, kind: Option<MediaKind>, episodes: bool) -> Result<Step, StepError> {
        let mut published = Vec::new();
        if !self.fresh(&id, episodes).await? {
            let meta = self.source.title(&id, kind).await?;
            published = self.publish_detail(meta, id).await?;
        }
        job.complete = true;
        Ok(Step { ended: true, published })
    }

    async fn known_kind(&self, id: &str) -> Result<Option<MediaKind>, StepError> {
        let id = id.to_owned();
        Ok(self.db.run(move |conn| record::kind_of(conn, &id)).await?)
    }

    pub(crate) async fn fresh(&self, id: &str, series_only: bool) -> Result<bool, StepError> {
        let metadata_ms = self.metadata.ms();
        let id = id.to_owned();
        Ok(self.db.run(move |conn| record::detail_fresh(conn, &id, series_only, metadata_ms)).await?)
    }
}
