use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use watchit_core::Background;

use crate::clock::now_ms;
use crate::model::CatalogKind;
use crate::sync::jobs::Job;
use crate::sync::publish::StepError;
use crate::sync::steps::Step;
use crate::sync::{Inner, Sync, delete_job, save_job};

const RETRY_MS: i64 = 60_000;
const BACKGROUND_INTERVAL_MS: i64 = 30_000;

impl Sync {
    pub fn start(&self, background: &Background) {
        if !self.inner.enabled {
            return;
        }
        let jobs = [CatalogKind::Movie, CatalogKind::Series, CatalogKind::Anime]
            .into_iter()
            .flat_map(|kind| [Self::discovery_job(kind), Self::trending_job(kind)]);
        let saved: Vec<Job> = {
            let mut queue = self.inner.queue.lock().unwrap();
            jobs.filter_map(|job| queue.ensure(job, 0, self.inner.metadata.ms())).collect()
        };
        let db = self.inner.db.clone();
        let inner = self.inner.clone();
        let stopping = background.stopping();
        background.spawn(async move {
            if let Err(error) = db.run(move |conn| saved.iter().try_for_each(|job| save_job(conn, job))).await {
                tracing::warn!(%error, "import jobs not saved");
            }
            inner.run(stopping).await;
        });
    }
}

impl Inner {
    async fn run(self: Arc<Self>, stopping: impl Future<Output = ()>) {
        let mut stopping = std::pin::pin!(stopping);
        let mut background_after = 0;
        loop {
            let now = now_ms();
            let picked = {
                let mut queue = self.queue.lock().unwrap();
                if queue.next_retry_at.is_some_and(|retry_at| retry_at <= now) {
                    queue.next_retry_at = None;
                }
                let metadata_ms = self.metadata.ms();
                match queue.next(now, metadata_ms) {
                    Some(job) if job.priority > 0 || now >= background_after => {
                        let job = job.clone();
                        queue.active = Some(job.key.clone());
                        Ok(job)
                    }
                    Some(_) => Err(background_after - now),
                    None => Err(queue.wait(now, metadata_ms)),
                }
            };
            let delay = match picked {
                Ok(job) => {
                    let background = job.priority == 0;
                    let ended = tokio::select! {
                        ended = self.process(job) => ended,
                        () = &mut stopping => return,
                    };
                    if background && ended {
                        background_after = now_ms() + BACKGROUND_INTERVAL_MS;
                    }
                    continue;
                }
                Err(delay) => delay,
            };
            tokio::select! {
                () = tokio::time::sleep(Duration::from_millis(delay.max(0) as u64)) => {}
                () = self.wake.notified() => {}
                () = &mut stopping => return,
            }
        }
    }

    async fn process(&self, mut job: Job) -> bool {
        let result = self.step(&mut job).await;
        let ended = matches!(result, Ok(Step { ended: true, .. }));
        let (saved, removed) = self.settle(job, result);
        let db = self.db.clone();
        let stored = db
            .run(move |conn| {
                saved.iter().try_for_each(|job| save_job(conn, job))?;
                removed.iter().try_for_each(|key| delete_job(conn, key))
            })
            .await;
        if let Err(error) = stored {
            tracing::warn!(%error, "import jobs not saved");
        }
        ended
    }

    fn settle(&self, mut job: Job, result: Result<Step, StepError>) -> (Vec<Job>, Vec<String>) {
        let now = now_ms();
        let mut queue = self.queue.lock().unwrap();
        queue.active = None;
        let current = queue.take(&job.key);
        job.priority = job.priority.max(current.map_or(0, |current| current.priority));
        let mut demote = true;
        match result {
            Ok(step) => {
                job.error = None;
                job.retry_at = 0;
                if step.ended {
                    job.updated_at = now;
                } else {
                    demote = false;
                }
                let published = |key: &str| {
                    step.published.iter().any(|id| key.strip_prefix("title:").or_else(|| key.strip_prefix("episodes:")) == Some(id.as_str()))
                };
                for other in queue.jobs.iter_mut().filter(|other| other.detail() && published(&other.key)) {
                    other.complete = true;
                    other.updated_at = now;
                    other.retry_at = 0;
                    other.error = None;
                }
                if queue.jobs.iter().all(|other| other.error.is_none()) {
                    queue.error = None;
                }
            }
            Err(error) => {
                let message = error.message();
                job.error = Some(message.clone());
                queue.error = Some(message);
                match error {
                    StepError::Source(error) if error.rejected() => {
                        job.complete = true;
                        job.updated_at = now;
                        job.retry_at = 0;
                    }
                    StepError::Source(error) => {
                        job.retry_at = now + RETRY_MS.max(error.retry_after.unwrap_or(0) as i64 * 1000);
                        queue.next_retry_at = Some(queue.next_retry_at.unwrap_or(0).max(job.retry_at));
                    }
                    StepError::Store(_) => job.retry_at = now + RETRY_MS,
                }
            }
        }
        if demote {
            job.priority = job.default_priority();
        }
        let mut saved = vec![job.clone()];
        let mut removed = Vec::new();
        if job.finished_detail() {
            removed.push(job.key.clone());
            saved.clear();
        } else if demote {
            queue.insert(job);
        } else {
            queue.jobs.insert(0, job);
            queue.jobs.sort_by_key(|item| std::cmp::Reverse(item.priority));
        }
        queue.jobs.retain(|other| {
            let finished = other.finished_detail();
            if finished {
                removed.push(other.key.clone());
            }
            !finished
        });
        saved.retain(|job| !removed.contains(&job.key));
        (saved, removed)
    }
}
