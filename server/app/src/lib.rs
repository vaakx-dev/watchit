mod api;
mod auth;
mod compression;
mod origin;
mod torrent_sources;
mod web;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use watchit_core::{Background, Context};

const DRAIN: Duration = Duration::from_secs(5);

pub struct Config {
    pub data_dir: PathBuf,
    pub listen: SocketAddr,
    pub web_dir: Option<PathBuf>,
}

pub struct Server {
    addr: SocketAddr,
    background: Background,
    http: JoinHandle<()>,
}

impl Server {
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    pub async fn shutdown(mut self) {
        self.background.stop();
        if tokio::time::timeout(DRAIN, &mut self.http).await.is_err() {
            self.http.abort();
        }
        self.background.finished().await;
    }
}

pub async fn start(config: Config) -> anyhow::Result<Server> {
    let context = Context::open(config.data_dir)?;
    let listener = TcpListener::bind(config.listen).await?;
    let addr = listener.local_addr()?;
    let mut router = api::router(&context, addr)?;
    if let Some(web_dir) = &config.web_dir {
        router = router.merge(web::router(web_dir));
    }
    let app = router.layer(compression::layer()).into_make_service_with_connect_info::<SocketAddr>();
    let stopping = context.background.stopping();
    let http = tokio::spawn(async move {
        if let Err(error) = axum::serve(listener, app).with_graceful_shutdown(stopping).await {
            tracing::error!(%error, "server stopped");
        }
    });
    Ok(Server { addr, background: context.background, http })
}
