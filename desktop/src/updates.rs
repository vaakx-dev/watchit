use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::MenuItem;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::server::EmbeddedServer;

const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(30);

pub struct Updates {
    item: MenuItem<Wry>,
    pending: Mutex<Option<Update>>,
}

impl Updates {
    pub fn new(item: MenuItem<Wry>) -> Self {
        Self { item, pending: Mutex::new(None) }
    }
}

pub fn spawn_checks(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_CHECK_DELAY).await;
        loop {
            if let Err(error) = check(&app).await {
                eprintln!("update check failed: {error}");
            }
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

pub fn activate(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let pending = app.state::<Updates>().pending.lock().unwrap().clone();
        let result = match pending {
            Some(update) => install(&app, update).await,
            None => check(&app).await,
        };
        if let Err(error) = result {
            eprintln!("update failed: {error}");
        }
    });
}

async fn check(app: &AppHandle) -> anyhow::Result<()> {
    let state = app.state::<Updates>();
    let update = app.updater()?.check().await?;
    let label = match &update {
        Some(update) => format!("Install Watchit {}", update.version),
        None => "Watchit is up to date".to_string(),
    };
    state.item.set_text(label)?;
    *state.pending.lock().unwrap() = update;
    Ok(())
}

async fn install(app: &AppHandle, update: Update) -> anyhow::Result<()> {
    app.state::<Updates>().item.set_text("Downloading update…")?;
    let installer = update.download(|_, _| {}, || {}).await?;
    app.state::<EmbeddedServer>().stop().await;
    update.install(installer)?;
    Ok(())
}

