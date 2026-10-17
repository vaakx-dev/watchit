use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use axum::routing::get;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use watchit_core::{Db, Paths};

pub struct Config {
    pub data_dir: PathBuf,
    pub listen: SocketAddr,
    pub web_dir: Option<PathBuf>,
}

pub struct Server {
    addr: SocketAddr,
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

impl Server {
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    pub async fn shutdown(self) {
        let _ = self.stop.send(());
        let _ = self.task.await;
    }
}

pub async fn start(config: Config) -> anyhow::Result<Server> {
    let paths = Paths::new(config.data_dir)?;
    let _db = Db::open(&paths.database())?;
    let router = Router::new().route("/api/health", get(|| async { "ok" }));
    let listener = TcpListener::bind(config.listen).await?;
    let addr = listener.local_addr()?;
    let (stop, stopped) = oneshot::channel::<()>();
    let task = tokio::spawn(async move {
        let shutdown = async { let _ = stopped.await; };
        if let Err(error) = axum::serve(listener, router).with_graceful_shutdown(shutdown).await {
            tracing::error!(%error, "server stopped");
        }
    });
    Ok(Server { addr, stop, task })
}
