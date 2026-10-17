mod add;
mod control;
mod disk;
mod entry;
mod events;
pub mod model;
mod pick;
mod reader;
mod record;
pub mod routes;
mod schedule;
mod season;
mod snapshot;
mod startup;
mod store;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use librqbit::Session;
use tokio::sync::{Notify, broadcast};
use watchit_core::{AppResult, Db};

pub use disk::Disk;
pub use entry::Entry;
pub use events::TransferEvent;
pub use record::{Choice, Pick};
pub use store::create_tables;

use crate::search::Search;
use crate::settings::Settings;
use crate::titles::Titles;

const EVENT_BUFFER: usize = 256;

pub struct Transfers {
    pub db: Db,
    pub session: Arc<Session>,
    pub search: Search,
    pub titles: Arc<dyn Titles>,
    settings: RwLock<Settings>,
    entries: Mutex<HashMap<String, Entry>>,
    events: broadcast::Sender<TransferEvent>,
    resolved: Notify,
    wake: Notify,
}

pub fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |elapsed| elapsed.as_secs() as i64)
}

impl Transfers {
    pub fn new(db: Db, session: Arc<Session>, search: Search, titles: Arc<dyn Titles>, settings: Settings) -> Arc<Self> {
        Arc::new(Self {
            db,
            session,
            search,
            titles,
            settings: RwLock::new(settings),
            entries: Mutex::default(),
            events: broadcast::channel(EVENT_BUFFER).0,
            resolved: Notify::new(),
            wake: Notify::new(),
        })
    }

    pub fn settings(&self) -> Settings {
        self.settings.read().expect("settings lock").clone()
    }

    pub fn entries(&self) -> MutexGuard<'_, HashMap<String, Entry>> {
        self.entries.lock().expect("transfers lock")
    }

    pub fn subscribe(&self) -> broadcast::Receiver<TransferEvent> {
        self.events.subscribe()
    }

    pub fn wake(&self) {
        self.wake.notify_one();
    }

    pub async fn persist(&self, info_hash: &str) -> AppResult<()> {
        let saved = self.entries().get(info_hash).map(|entry| (entry.record.clone(), entry.files.clone()));
        let Some((record, files)) = saved else { return Ok(()) };
        self.db.run(move |conn| store::save(conn, &record, &files)).await
    }

    pub async fn update_settings(&self, settings: Settings) -> AppResult<Settings> {
        let settings = settings.validated()?;
        let saved = settings.clone();
        self.db.run(move |conn| crate::settings::save(conn, &saved)).await?;
        crate::engine::apply_limits(&self.session, &settings);
        *self.settings.write().expect("settings lock") = settings.clone();
        self.wake();
        Ok(settings)
    }
}
