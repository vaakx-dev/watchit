use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent};
use watchit_server::{Config, Server};

const DEFAULT_PORT: u16 = 7171;
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

pub struct EmbeddedServer {
    server: Mutex<Option<Server>>,
}

impl EmbeddedServer {
    pub async fn stop(&self) {
        let server = self.server.lock().unwrap().take();
        if let Some(server) = server {
            let _ = tokio::time::timeout(SHUTDOWN_TIMEOUT, server.shutdown()).await;
        }
    }
}

pub fn start(app: &AppHandle) -> anyhow::Result<u16> {
    let data_dir = match std::env::var_os("WATCHIT_DATA_DIR") {
        Some(dir) => PathBuf::from(dir),
        None => app.path().app_data_dir()?,
    };
    let web_dir = match std::env::var_os("WATCHIT_WEB_DIR") {
        Some(dir) => PathBuf::from(dir),
        None => app.path().resource_dir()?.join("web"),
    };
    let port = match std::env::var("WATCHIT_PORT") {
        Ok(port) => port.parse()?,
        Err(_) => DEFAULT_PORT,
    };
    let listen = SocketAddr::from((Ipv4Addr::UNSPECIFIED, port));
    let server = tauri::async_runtime::block_on(watchit_server::start(Config {
        data_dir,
        listen,
        web_dir: Some(web_dir),
    }))?;
    let port = server.addr().port();
    app.manage(EmbeddedServer { server: Mutex::new(Some(server)) });
    Ok(port)
}

pub fn on_run_event(app: &AppHandle, event: RunEvent) {
    let RunEvent::ExitRequested { api, .. } = event else {
        return;
    };
    let state = app.state::<EmbeddedServer>();
    if state.server.lock().unwrap().is_none() {
        return;
    }
    api.prevent_exit();
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        app.state::<EmbeddedServer>().stop().await;
        app.exit(0);
    });
}
