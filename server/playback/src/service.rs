use std::collections::HashMap;
use std::hash::Hash;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use tokio::sync::OnceCell;
use watchit_core::{AppError, AppResult, Background, Context, StreamTokens, Viewer};

use crate::api::{CreateSession, Mode, PlaybackSession, Player};
use crate::decide::{VideoPlan, decide};
use crate::ffmpeg::{Encoders, Tools, detect};
use crate::hls::{Job, Recipe, segment_at, vod_playlist};
use crate::keyframes::keyframes;
use crate::probe::{Media, probe};
use crate::session::{Session, SessionParts};
use crate::source::{SourceRef, SourceResolver};
use crate::subtitles::Subtitles;
use crate::urls::{raw_path, session_prefix};

const SWEEP_EVERY: Duration = Duration::from_secs(15);
const JOB_IDLE: Duration = Duration::from_secs(60);
const SESSION_IDLE: Duration = Duration::from_secs(60 * 60);

type Cache<K, V> = Mutex<HashMap<K, Arc<OnceCell<V>>>>;

pub struct Playback {
    tools: Tools,
    background: Background,
    sessions_dir: PathBuf,
    sources: Arc<dyn SourceResolver>,
    tokens: StreamTokens,
    encoders: Arc<OnceCell<Encoders>>,
    media: Cache<SourceRef, Arc<Media>>,
    keyframes: Cache<SourceRef, Option<Vec<f64>>>,
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    subtitles: Subtitles,
}

impl Playback {
    pub fn open(context: &Context, sources: Arc<dyn SourceResolver>, ffmpeg_dir: &Path) -> AppResult<Arc<Self>> {
        let tools = Tools::in_dir(ffmpeg_dir);
        let work_dir = context.paths.folder("playback")?;
        let sessions_dir = work_dir.join("sessions");
        if sessions_dir.exists() {
            std::fs::remove_dir_all(&sessions_dir)?;
        }
        std::fs::create_dir_all(&sessions_dir)?;
        let playback = Arc::new(Self {
            subtitles: Subtitles::new(tools.clone(), work_dir.join("subtitles")),
            tools,
            background: context.background.clone(),
            sessions_dir,
            sources,
            tokens: context.tokens.clone(),
            encoders: Arc::new(OnceCell::new()),
            media: Mutex::default(),
            keyframes: Mutex::default(),
            sessions: Mutex::default(),
        });
        let (tools, encoders) = (playback.tools.clone(), playback.encoders.clone());
        context.background.spawn(async move {
            encoders.get_or_init(|| detect(&tools)).await;
        });
        context.background.spawn(sweep(Arc::downgrade(&playback), context.background.stopping()));
        Ok(playback)
    }

    pub async fn create(&self, viewer: &Viewer, request: CreateSession) -> AppResult<PlaybackSession> {
        let encoders = *self.encoders.get_or_init(|| detect(&self.tools)).await;
        let source = request.source.clone();
        let input = self.sources.resolve(viewer, &source).await?;
        let media = cached(&self.media, &source, || async { probe(&self.tools, &input).await.map(Arc::new) }).await?;
        let decision = decide(&media, &request, encoders)?;
        let id = uuid::Uuid::new_v4().simple().to_string();
        tracing::info!(session = %id, title = %request.title_id, mode = ?decision.mode, reasons = ?decision.reasons, "playback session");
        let job = match decision.mode {
            Mode::Direct => None,
            _ => {
                let copies_video = matches!(decision.video, Some(VideoPlan::Copy));
                let keyframes = if copies_video { cached(&self.keyframes, &source, || async { Ok(keyframes(&input, &media).await) }).await? } else { None };
                let recipe = Recipe::new(input.clone(), &media, &decision, keyframes, encoders)?;
                let first = segment_at(&recipe.segments, request.start_seconds.unwrap_or(0.0));
                Some(Job::start(recipe, self.tools.clone(), self.background.clone(), self.sessions_dir.join(&id), first)?)
            }
        };
        let token = self.tokens.mint(viewer.profile, &session_prefix(&id));
        let direct_url = self.tokens.url(viewer.profile, &raw_path(&source));
        let converts_subtitles = request.client.player == Player::Browser;
        let parts = SessionParts { id: id.clone(), owner: viewer.profile, source, input, media, mode: decision.mode, job, token, direct_url, converts_subtitles };
        let session = Session::new(parts);
        let response = session.response.clone();
        self.lock_sessions().insert(id, Arc::new(session));
        Ok(response)
    }

    pub fn delete(&self, viewer: &Viewer, id: &str) -> AppResult<()> {
        let mut sessions = self.lock_sessions();
        let owned = sessions.get(id).is_some_and(|session| session.owner == viewer.profile || viewer.admin);
        if !owned {
            return Err(not_found());
        }
        if let Some(session) = sessions.remove(id) {
            self.discard(session);
        }
        Ok(())
    }

    pub fn playlist(&self, id: &str) -> AppResult<String> {
        let session = self.session(id)?;
        let job = session.job.as_ref().ok_or_else(not_found)?;
        Ok(vod_playlist(&job.recipe().segments, &session.token))
    }

    pub async fn segment(&self, id: &str, index: usize) -> AppResult<PathBuf> {
        let session = self.session(id)?;
        let job = session.job.as_ref().ok_or_else(not_found)?;
        if index >= job.recipe().segments.len() {
            return Err(not_found());
        }
        let path = job.segment(index).await;
        session.touch();
        path
    }

    pub async fn subtitle(&self, id: &str, stream: u32) -> AppResult<PathBuf> {
        let session = self.session(id)?;
        let listed = session.response.subtitle_tracks.iter().any(|track| track.index == stream && track.url.is_some());
        if !listed {
            return Err(not_found());
        }
        self.subtitles.webvtt(&session.source, &session.input, stream).await
    }

    fn shutdown(&self) {
        let sessions: Vec<_> = self.lock_sessions().drain().map(|(_, session)| session).collect();
        for job in sessions.iter().filter_map(|session| session.job.as_ref()) {
            job.pause();
        }
    }

    fn session(&self, id: &str) -> AppResult<Arc<Session>> {
        let session = self.lock_sessions().get(id).cloned().ok_or_else(not_found)?;
        session.touch();
        Ok(session)
    }

    fn lock_sessions(&self) -> std::sync::MutexGuard<'_, HashMap<String, Arc<Session>>> {
        self.sessions.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn discard(&self, session: Arc<Session>) {
        if let Some(job) = &session.job {
            job.pause();
        }
        let directory = self.sessions_dir.join(&session.id);
        self.background.spawn(async move {
            drop(session);
            for _ in 0..10 {
                tokio::time::sleep(Duration::from_secs(1)).await;
                if tokio::fs::remove_dir_all(&directory).await.is_ok() || !directory.exists() {
                    return;
                }
            }
        });
    }

    fn sweep_once(&self) {
        let sessions: Vec<_> = self.lock_sessions().values().cloned().collect();
        for session in sessions {
            if session.idle_for() > SESSION_IDLE {
                if let Some(session) = self.lock_sessions().remove(&session.id) {
                    self.discard(session);
                }
            } else if let Some(job) = &session.job
                && job.idle_for() > JOB_IDLE
            {
                job.pause();
            }
        }
    }
}

async fn sweep(playback: Weak<Playback>, stopping: impl Future<Output = ()>) {
    let mut interval = tokio::time::interval(SWEEP_EVERY);
    tokio::pin!(stopping);
    loop {
        tokio::select! {
            _ = interval.tick() => {}
            _ = &mut stopping => break,
        }
        let Some(playback) = playback.upgrade() else { return };
        playback.sweep_once();
    }
    if let Some(playback) = playback.upgrade() {
        playback.shutdown();
    }
}

async fn cached<K, V, F, Fut>(cache: &Cache<K, V>, key: &K, init: F) -> AppResult<V>
where
    K: Eq + Hash + Clone,
    V: Clone,
    F: FnOnce() -> Fut,
    Fut: Future<Output = AppResult<V>>,
{
    let cell = cache.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).entry(key.clone()).or_default().clone();
    cell.get_or_try_init(init).await.cloned()
}

fn not_found() -> AppError {
    AppError::not_found("No such playback session.")
}
