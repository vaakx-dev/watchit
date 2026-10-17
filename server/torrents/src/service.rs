use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;

use axum::http::StatusCode;
use tokio::sync::watch;
use watchit_core::{AppError, AppResult, Background, Context, StreamTokens, Viewer};

use crate::engine;
use crate::media::{MediaSource, TorrentFile, raw_url};
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
    tokens: StreamTokens,
    background: Background,
    startup: watch::Receiver<Startup>,
}

fn listen_port() -> u16 {
    std::env::var(LISTEN_PORT_VARIABLE).ok().and_then(|port| port.parse().ok()).unwrap_or(DEFAULT_LISTEN_PORT)
}

struct Launch {
    context: Context,
    folder: PathBuf,
    settings: Settings,
    search: Search,
    titles: Arc<dyn Titles>,
    ready: watch::Sender<Startup>,
}

async fn launch(launch: Launch) {
    let Launch { context, folder, settings, search, titles, ready } = launch;
    let session = match engine::start(&folder, listen_port(), &settings).await {
        Ok(session) => session,
        Err(error) => {
            tracing::error!(error = format!("{error:#}"), "torrent engine failed to start");
            let _ = ready.send(Startup::Failed(format!("The torrent engine failed to start: {error:#}")));
            return;
        }
    };
    let transfers = Transfers::new(context.db.clone(), Arc::clone(&session), search, titles, engine::session_folder(&folder), settings);
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
            transfers::create_tables(conn)?;
            queue::create_table(conn)
        })?;
        let folder = std::path::absolute(context.paths.folder("torrents")?)?;
        let default_download_dir = std::path::absolute(context.paths.folder("downloads")?)?;
        let settings = context.db.run_blocking(|conn| settings::load(conn))?.unwrap_or_else(|| Settings::defaults(default_download_dir));
        std::fs::create_dir_all(settings.download_dir())?;
        let search = Search::new(reqwest::Client::new(), Arc::clone(&titles));
        let (ready, startup) = watch::channel(Startup::Starting);
        let launching = Launch { context: context.clone(), folder, settings, search: search.clone(), titles, ready };
        context.background.spawn(launch(launching));
        Ok(Self { search, tokens: context.tokens.clone(), background: context.background.clone(), startup })
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
            return Ok(MediaSource::File(transfers.disk_path(&handle, file_index)?));
        }
        Ok(MediaSource::Url(format!("{origin}{}", raw_url(&self.tokens, viewer.profile, &info_hash, file_index))))
    }

    pub async fn files(&self, info_hash: &str) -> AppResult<Vec<TorrentFile>> {
        let transfers = self.transfers().await?;
        let handle = transfers.ready_handle(&info_hash.to_ascii_lowercase()).await?;
        let files = engine::files_of(&handle).map_err(AppError::internal)?;
        Ok(files.into_iter().map(|file| TorrentFile { index: file.index, path: file.path }).collect())
    }
}
