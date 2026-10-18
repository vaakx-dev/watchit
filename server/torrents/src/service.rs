use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;

use axum::http::StatusCode;
use tokio::sync::watch;
use watchit_core::{AppError, AppResult, Background, Context, Db, StreamTokens, Viewer};

use crate::bandwidth::{self, Bandwidth};
use crate::engine;
use crate::media::{MediaSource, TorrentFile, raw_url};
use crate::quality::{self, Quality};
use crate::queue;
use crate::search::Search;
use crate::settings::{self, Settings};
use crate::titles::Titles;
use crate::transfers::{self, Transfers};

const DEFAULT_LISTEN_PORT: u16 = 4240;
const LISTEN_PORT_VARIABLE: &str = "WATCHIT_TORRENT_PORT";

#[derive(Clone)]
enum Startup {
    Starting,
    Ready(Arc<Transfers>),
    Failed(String),
}

#[derive(Clone)]
pub struct Torrents {
    search: Search,
    db: Db,
    tokens: StreamTokens,
    background: Background,
    startup: watch::Receiver<Startup>,
}

fn listen_port() -> Option<u16> {
    match std::env::var(LISTEN_PORT_VARIABLE) {
        Ok(value) if value == "off" => None,
        Ok(value) => Some(value.parse().unwrap_or(DEFAULT_LISTEN_PORT)),
        Err(_) => Some(DEFAULT_LISTEN_PORT),
    }
}

struct Launch {
    context: Context,
    folder: PathBuf,
    settings: Settings,
    alternative: bool,
    search: Search,
    titles: Arc<dyn Titles>,
    ready: watch::Sender<Startup>,
}

async fn launch(launch: Launch) {
    let Launch {
        context,
        folder,
        settings,
        alternative,
        search,
        titles,
        ready,
    } = launch;
    let bandwidth = Bandwidth::new(&settings, alternative);
    let session = match engine::start(&folder, listen_port(), settings.download_dir(), bandwidth.limits()).await {
        Ok(session) => session,
        Err(error) => {
            tracing::error!(error = format!("{error:#}"), "torrent engine failed to start");
            let _ = ready.send(Startup::Failed(format!("The torrent engine failed to start: {error:#}")));
            return;
        }
    };
    let transfers = Transfers::new(
        context.db.clone(),
        Arc::clone(&session),
        search,
        titles,
        engine::session_folder(&folder),
        settings,
        bandwidth,
    );
    if let Err(error) = transfers.restore().await {
        tracing::error!(%error, "could not restore transfers");
    }
    let _ = ready.send(Startup::Ready(Arc::clone(&transfers)));
    transfers.run_scheduler(context.background.stopping()).await;
    session.stop().await;
}

impl Torrents {
    pub fn open(context: &Context, titles: Arc<dyn Titles>) -> AppResult<Self> {
        context.db.run_blocking(|conn| {
            settings::create_table(conn)?;
            bandwidth::create_table(conn)?;
            transfers::create_tables(conn)?;
            crate::locations::create_library_table(conn)?;
            queue::create_table(conn)?;
            quality::create_table(conn)
        })?;
        let folder = std::path::absolute(context.paths.folder("torrents")?)?;
        let default_download_dir = std::path::absolute(context.paths.folder("downloads")?)?;
        let settings = context
            .db
            .run_blocking(|conn| settings::load(conn))?
            .unwrap_or_else(|| Settings::defaults(default_download_dir));
        let alternative = context.db.run_blocking(|conn| bandwidth::load(conn))?;
        std::fs::create_dir_all(settings.download_dir())?;
        let search = Search::new(reqwest::Client::new(), Arc::clone(&titles));
        let (ready, startup) = watch::channel(Startup::Starting);
        let launching = Launch {
            context: context.clone(),
            folder,
            settings,
            alternative,
            search: search.clone(),
            titles,
            ready,
        };
        context.background.spawn(launch(launching));
        Ok(Self {
            search,
            db: context.db.clone(),
            tokens: context.tokens.clone(),
            background: context.background.clone(),
            startup,
        })
    }

    pub async fn quality(&self, profile: i64) -> AppResult<Quality> {
        self.db.run(move |conn| quality::load(conn, profile)).await
    }

    pub async fn save_quality(&self, profile: i64, quality: Quality) -> AppResult<Quality> {
        self.db
            .run(move |conn| {
                quality::save(conn, profile, &quality)?;
                Ok(quality)
            })
            .await
    }

    pub fn search(&self) -> &Search {
        &self.search
    }

    pub fn stopping(&self) -> impl Future<Output = ()> + Send + 'static + use<> {
        let background = self.background.clone();
        async move { background.stopping().await }
    }

    pub async fn transfers(&self) -> AppResult<Arc<Transfers>> {
        let mut startup = self.startup.clone();
        let state = startup
            .wait_for(|state| !matches!(state, Startup::Starting))
            .await
            .map_err(|_| AppError::new(StatusCode::SERVICE_UNAVAILABLE, "The torrent engine is stopping."))?
            .clone();
        match state {
            Startup::Ready(transfers) => Ok(transfers),
            Startup::Failed(message) => Err(AppError::new(StatusCode::SERVICE_UNAVAILABLE, message)),
            Startup::Starting => Err(AppError::new(StatusCode::SERVICE_UNAVAILABLE, "The torrent engine is starting.").retry_after(2)),
        }
    }

    pub async fn source(&self, viewer: &Viewer, info_hash: &str, file_index: usize, origin: &str) -> AppResult<MediaSource> {
        let transfers = self.transfers().await?;
        let info_hash = info_hash.to_ascii_lowercase();
        let handle = transfers.ready_handle(&info_hash).await?;
        transfers.select_file(&info_hash, file_index, &handle)?;
        transfers.resume_for_playback(&info_hash).await?;
        if transfers.complete_file(&info_hash, file_index) {
            return Ok(MediaSource::File(transfers.finished_path(&info_hash, &handle, file_index)?));
        }
        Ok(MediaSource::Url(format!(
            "{origin}{}",
            raw_url(&self.tokens, viewer.profile, &info_hash, file_index)
        )))
    }

    pub async fn files(&self, info_hash: &str) -> AppResult<Vec<TorrentFile>> {
        let transfers = self.transfers().await?;
        let handle = transfers.ready_handle(&info_hash.to_ascii_lowercase()).await?;
        let files = engine::files_of(&handle).map_err(AppError::internal)?;
        Ok(files
            .into_iter()
            .map(|file| TorrentFile {
                index: file.index,
                path: file.path,
            })
            .collect())
    }
}
