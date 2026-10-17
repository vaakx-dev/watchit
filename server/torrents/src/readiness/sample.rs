use std::sync::Arc;
use std::time::Duration;

use librqbit::{Session, TorrentStatsState};

use super::contiguous::{contiguous_from, geometry};
use super::estimate::{Inputs, estimate};
use super::model::{Readiness, Verdict};
use super::target::{Target, choose};
use crate::engine::Handle;
use crate::transfers::Transfers;

const LONGEST_SAMPLE: f64 = 5.0;

struct Job {
    info_hash: String,
    handle: Option<Handle>,
    target: Target,
    cached_runtime: Option<u32>,
    speed: f64,
    running: bool,
    was_ready: bool,
}

struct Sampled {
    info_hash: String,
    file: usize,
    title_id: String,
    runtime: Option<u32>,
    readiness: Readiness,
}

fn have_ahead(session: &Arc<Session>, job: &Job) -> u64 {
    let remaining = job.target.size_bytes.saturating_sub(job.target.position);
    if job.target.complete {
        return remaining;
    }
    let Some(handle) = &job.handle else { return 0 };
    let Some(geometry) = geometry(handle, job.target.index) else { return 0 };
    contiguous_from(session, handle, &geometry, job.target.position)
}

impl Transfers {
    pub async fn sample_readiness(&self, elapsed: Duration) {
        let jobs = self.readiness_jobs(elapsed.as_secs_f64().min(LONGEST_SAMPLE));
        let session = Arc::clone(&self.session);
        let measured = tokio::task::spawn_blocking(move || {
            jobs.into_iter().map(|job| (have_ahead(&session, &job), job)).collect::<Vec<_>>()
        })
        .await;
        let Ok(measured) = measured else { return };
        let mut results = Vec::with_capacity(measured.len());
        for (have_ahead, job) in measured {
            let runtime = match job.cached_runtime {
                Some(minutes) => Some(minutes),
                None => self.titles.runtime_minutes(&job.target.title_id).await,
            };
            let title_id = job.target.title_id.clone();
            let readiness = estimate(&Inputs {
                size_bytes: job.target.size_bytes,
                position: job.target.position,
                have_ahead,
                runtime_seconds: runtime.map(|minutes| f64::from(minutes) * 60.0),
                speed: job.speed,
                running: job.running,
                was_ready: job.was_ready,
            });
            results.push(Sampled { info_hash: job.info_hash, file: job.target.index, title_id, runtime, readiness });
        }
        let mut entries = self.entries();
        for sampled in results {
            let Some(entry) = entries.get_mut(&sampled.info_hash) else { continue };
            if let Some(minutes) = sampled.runtime {
                entry.readiness.runtimes.insert(sampled.title_id, minutes);
            }
            entry.readiness.target = Some(sampled.file);
            entry.readiness.current = sampled.readiness;
        }
    }

    fn readiness_jobs(&self, seconds: f64) -> Vec<Job> {
        let mut jobs = Vec::new();
        for entry in self.entries().values_mut() {
            let progress = entry.progress();
            let live = progress.stats.as_ref().and_then(|stats| stats.live.as_ref());
            let running = progress.is_live() && !entry.record.paused && !progress.finished();
            match live.filter(|_| running) {
                Some(live) => entry.readiness.speed.update(seconds.max(f64::EPSILON), live.download_speed.as_bytes() as f64),
                None => entry.readiness.speed.reset(),
            }
            let Some(target) = choose(entry, &progress) else {
                entry.readiness.current = Readiness::UNKNOWN;
                entry.readiness.target = None;
                continue;
            };
            let engine_idle = matches!(progress.engine_state(), None | Some(TorrentStatsState::Error));
            if engine_idle && !target.complete {
                entry.readiness.current = Readiness::UNKNOWN;
                entry.readiness.target = Some(target.index);
                continue;
            }
            let latched = entry.readiness.target == Some(target.index) && entry.readiness.current.state == Verdict::Ready;
            jobs.push(Job {
                info_hash: entry.record.info_hash.clone(),
                handle: entry.handle.clone(),
                cached_runtime: entry.readiness.runtimes.get(&target.title_id).copied(),
                speed: entry.readiness.speed.bytes_per_second(),
                running,
                was_ready: latched,
                target,
            });
        }
        jobs
    }
}
