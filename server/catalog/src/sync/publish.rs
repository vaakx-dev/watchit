use watchit_core::AppResult;

use crate::cinemeta::error::SourceError;
use crate::cinemeta::mapping::{apply, episodes, lacks};
use crate::cinemeta::meta::Meta;
use crate::clock::now_ms;
use crate::model::MediaKind;
use crate::store::record::{self, detail_fresh};
use crate::sync::Inner;

pub(crate) struct Published {
    pub id: String,
    pub kind: MediaKind,
    pub anime: bool,
    pub needs_detail: bool,
}

pub(crate) struct Filters {
    pub anime: bool,
    pub genre: bool,
}

pub(crate) enum StepError {
    Source(SourceError),
    Store(watchit_core::AppError),
}

impl From<SourceError> for StepError {
    fn from(error: SourceError) -> Self {
        Self::Source(error)
    }
}

impl From<watchit_core::AppError> for StepError {
    fn from(error: watchit_core::AppError) -> Self {
        Self::Store(error)
    }
}

impl StepError {
    pub fn message(&self) -> String {
        match self {
            Self::Source(error) => error.message.clone(),
            Self::Store(error) => error.message.clone(),
        }
    }
}

impl Inner {
    pub(crate) async fn publish_catalog(&self, metas: Vec<Meta>, filters: Filters) -> AppResult<Vec<Published>> {
        let metadata_ms = self.metadata.ms();
        let (published, changed) = self
            .db
            .run(move |conn| {
                let transaction = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
                let mut records = Vec::with_capacity(metas.len());
                let mut lacking = Vec::with_capacity(metas.len());
                for meta in &metas {
                    let previous = record::load(&transaction, meta.id())?;
                    if let Some(record) = apply(previous, meta) {
                        lacking.push(lacks(meta, filters.anime, filters.genre));
                        records.push(record);
                    }
                }
                let changed = record::save(&transaction, &records, None)?;
                let mut published = Vec::with_capacity(records.len());
                for (record, lacking) in records.into_iter().zip(lacking) {
                    let needs_detail = lacking && !detail_fresh(&transaction, &record.id, false, metadata_ms)?;
                    published.push(Published { id: record.id, kind: record.kind, anime: record.anime, needs_detail });
                }
                transaction.commit()?;
                Ok((published, changed))
            })
            .await?;
        self.published(changed).await?;
        Ok(published)
    }

    pub(crate) async fn publish_detail(&self, meta: Meta, requested: String) -> Result<Vec<String>, StepError> {
        let (ids, changed) = self
            .db
            .run(move |conn| {
                let transaction = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
                let previous = record::load(&transaction, meta.id())?;
                let Some(parent) = apply(previous, &meta) else { return Ok(None) };
                let mut records = vec![parent];
                if records[0].kind == MediaKind::Series {
                    let listed = episodes(&meta, &records[0]);
                    records.extend(listed);
                }
                if records.iter().all(|record| record.id != requested) {
                    return Ok(None);
                }
                let ids: Vec<String> = records.iter().map(|record| record.id.clone()).collect();
                let changed = record::save(&transaction, &records, Some(now_ms()))?;
                transaction.commit()?;
                Ok(Some((ids, changed)))
            })
            .await?
            .ok_or_else(SourceError::missing)?;
        self.published(changed).await?;
        Ok(ids)
    }

    async fn published(&self, changed: Vec<String>) -> AppResult<()> {
        if changed.is_empty() {
            return Ok(());
        }
        self.facets.clear();
        self.attribution.enqueue(changed);
        let count = self.db.run(|conn| record::browsable_count(conn)).await?;
        self.imported.store(count, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    }
}
