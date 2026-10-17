use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, Weak};
use std::time::{Duration, Instant};

use tokio::sync::{Notify, OnceCell, oneshot};
use watchit_core::{AppError, AppResult, Background};

use super::fragments::read_init;
use super::recipe::Recipe;
use super::run::{RunEvent, RunExit, spawn};
use super::segments::SEGMENT_SECONDS;
use crate::ffmpeg::Tools;

const RESTART_GAP: usize = (24.0 / SEGMENT_SECONDS) as usize;
const THROTTLE_SEGMENTS: usize = (180.0 / SEGMENT_SECONDS) as usize;
const KEEP_SEGMENTS: usize = (720.0 / SEGMENT_SECONDS) as usize;
const MAX_STARTS_PER_REQUEST: u32 = 2;

pub struct Job {
    inner: Arc<Inner>,
    init: OnceCell<Vec<u8>>,
}

struct Inner {
    recipe: Recipe,
    tools: Tools,
    background: Background,
    directory: PathBuf,
    state: Mutex<State>,
    changed: Notify,
}

struct State {
    ready: BTreeMap<usize, PathBuf>,
    run: Option<Run>,
    runs: u64,
    last_request: usize,
    last_access: Instant,
    waiting: usize,
}

struct Run {
    id: u64,
    first: usize,
    end: usize,
    latest: Option<usize>,
    exit: Option<RunExit>,
    stop: Option<oneshot::Sender<()>>,
}

impl Run {
    fn covers(&self, index: usize) -> bool {
        let current = self.latest.map_or(self.first, |latest| latest + 1);
        self.exit.is_none() && index >= self.first && index < self.end && index <= current + RESTART_GAP
    }

    fn stop(&mut self) {
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
    }
}

impl Job {
    pub fn start(recipe: Recipe, tools: Tools, background: Background, directory: PathBuf, first: usize) -> AppResult<Self> {
        let state = State { ready: BTreeMap::new(), run: None, runs: 0, last_request: first, last_access: Instant::now(), waiting: 0 };
        let inner = Arc::new(Inner { recipe, tools, background, directory, state: Mutex::new(state), changed: Notify::new() });
        inner.start_run(&mut inner.lock(), first)?;
        Ok(Self { inner, init: OnceCell::new() })
    }

    pub fn recipe(&self) -> &Recipe {
        &self.inner.recipe
    }

    pub async fn init(&self) -> AppResult<&[u8]> {
        let init = self
            .init
            .get_or_try_init(|| async {
                let current = self.inner.lock().last_request;
                let path = self.segment(current).await?;
                read_init(&path).await.map_err(AppError::internal)
            })
            .await?;
        Ok(init)
    }

    pub async fn segment(&self, index: usize) -> AppResult<PathBuf> {
        let _waiting = Waiting::enter(&self.inner);
        let mut starts = 0;
        loop {
            let changed = self.inner.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            {
                let mut state = self.inner.lock();
                state.last_request = index;
                state.last_access = Instant::now();
                if let Some(path) = state.ready.get(&index) {
                    return Ok(path.clone());
                }
                let covered = state.run.as_ref().is_some_and(|run| run.covers(index));
                if !covered {
                    if starts == MAX_STARTS_PER_REQUEST {
                        return Err(failure(&state, index));
                    }
                    starts += 1;
                    self.inner.start_run(&mut state, index)?;
                }
            }
            changed.await;
        }
    }

    pub fn idle_for(&self) -> Duration {
        let state = self.inner.lock();
        if state.waiting > 0 { Duration::ZERO } else { state.last_access.elapsed() }
    }

    pub fn pause(&self) {
        if let Some(run) = self.inner.lock().run.as_mut() {
            run.stop();
        }
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        self.pause();
    }
}

impl Inner {
    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn start_run(self: &Arc<Self>, state: &mut State, first: usize) -> AppResult<()> {
        if let Some(previous) = state.run.as_mut() {
            previous.stop();
        }
        state.runs += 1;
        let id = state.runs;
        let end = self.recipe.run_end(first);
        let (stop, stopped) = oneshot::channel();
        let directory = self.directory.join(format!("run-{id}"));
        let weak = Arc::downgrade(self);
        spawn(&self.tools, &self.background, &directory, &self.recipe.arguments(first, end), stopped, move |event| on_event(&weak, id, event)).map_err(AppError::internal)?;
        state.run = Some(Run { id, first, end, latest: None, exit: None, stop: Some(stop) });
        Ok(())
    }
}

fn on_event(inner: &Weak<Inner>, id: u64, event: RunEvent) {
    let Some(inner) = inner.upgrade() else { return };
    {
        let mut state = inner.lock();
        let throttle_after = state.last_request + THROTTLE_SEGMENTS;
        let current = state.run.as_mut().filter(|run| run.id == id);
        match event {
            RunEvent::Segment(index, path) => {
                if let Some(run) = current {
                    run.latest = Some(index);
                    if index > throttle_after {
                        run.stop();
                    }
                }
                state.ready.insert(index, path);
                discard_distant(&mut state);
            }
            RunEvent::Exit(exit) => {
                if let Some(run) = current {
                    run.exit = Some(exit);
                    run.stop = None;
                }
            }
        }
    }
    inner.changed.notify_waiters();
}

fn discard_distant(state: &mut State) {
    let kept = state.last_request.saturating_sub(KEEP_SEGMENTS)..=state.last_request + KEEP_SEGMENTS;
    let distant: Vec<usize> = state.ready.keys().copied().filter(|index| !kept.contains(index)).collect();
    for index in distant {
        if let Some(path) = state.ready.remove(&index) {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn failure(state: &State, index: usize) -> AppError {
    match state.run.as_ref().and_then(|run| run.exit.as_ref()) {
        Some(RunExit::Failed(error)) => AppError::internal(error),
        _ => AppError::internal(format!("Segment {index} was not produced.")),
    }
}

struct Waiting<'a>(&'a Inner);

impl<'a> Waiting<'a> {
    fn enter(inner: &'a Inner) -> Self {
        inner.lock().waiting += 1;
        Self(inner)
    }
}

impl Drop for Waiting<'_> {
    fn drop(&mut self) {
        self.0.lock().waiting -= 1;
    }
}
