mod files;
mod records;

use std::collections::HashSet;
use std::path::PathBuf;

use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use tokio::sync::{broadcast, mpsc};
use watchit_artwork::{Artwork, Fetched, ImageKey};
use watchit_core::{AppError, AppResult, Context, Db};

use crate::clock::{iso, now_ms};
use crate::store::titles::{stored, view};
use files::{prepare, read_json, write_json};
use records::{ImageRecord, local_images, title_record};

#[derive(Clone)]
pub(crate) struct Attribution {
    sender: mpsc::UnboundedSender<Vec<String>>,
}

struct Archive {
    db: Db,
    folder: PathBuf,
}

impl Attribution {
    pub fn open(context: &Context, artwork: &Artwork) -> AppResult<Self> {
        let folder = context.paths.folder("attribution").map_err(AppError::internal)?;
        prepare(&folder).map_err(AppError::internal)?;
        let (sender, receiver) = mpsc::unbounded_channel();
        let archive = Archive { db: context.db.clone(), folder };
        let stopping = context.background.stopping();
        context.background.spawn(archive.run(receiver, artwork.subscribe(), stopping));
        Ok(Self { sender })
    }

    pub fn enqueue(&self, ids: Vec<String>) {
        let _ = self.sender.send(ids);
    }
}

impl Archive {
    async fn run(
        self,
        mut titles: mpsc::UnboundedReceiver<Vec<String>>,
        mut fetched: broadcast::Receiver<Fetched>,
        stopping: impl Future<Output = ()>,
    ) {
        let mut stopping = std::pin::pin!(stopping);
        let mut stop = false;
        while !stop {
            let mut ids: Vec<String> = Vec::new();
            let mut images: Vec<Fetched> = Vec::new();
            tokio::select! {
                Some(batch) = titles.recv() => ids.extend(batch),
                Ok(event) = fetched.recv() => images.push(event),
                () = &mut stopping => stop = true,
            }
            while let Ok(batch) = titles.try_recv() {
                ids.extend(batch);
            }
            while let Ok(event) = fetched.try_recv() {
                images.push(event);
            }
            let mut unique = HashSet::new();
            ids.retain(|id| unique.insert(id.clone()));
            let (db, folder) = (self.db.clone(), self.folder.clone());
            let written = tokio::task::spawn_blocking(move || {
                for id in &ids {
                    record_title(&db, &folder, id)?;
                }
                for event in &images {
                    record_fetch(&folder, event)?;
                }
                AppResult::Ok(())
            })
            .await;
            match written {
                Ok(Err(error)) => tracing::warn!(%error, "attribution record not written"),
                Err(error) => tracing::warn!(%error, "attribution writer stopped"),
                Ok(Ok(())) => {}
            }
        }
    }
}

fn record_title(db: &Db, folder: &std::path::Path, id: &str) -> AppResult<()> {
    let title = db.run_blocking(|conn| {
        let Some(stored) = stored(conn, id)? else { return Ok(None) };
        let keys: Vec<ImageKey> = stored.poster.iter().cloned().collect();
        let images = Artwork::versions(conn, &keys)?;
        Ok(Some(view(&stored, &images)))
    })?;
    let Some(title) = title else { return Ok(()) };
    let recorded_at = iso(now_ms());
    let images = local_images(&title);
    for image in &images {
        let path = folder.join("images").join(format!("{}.json", image.key));
        let previous: Option<ImageRecord> = read_json(&path)?;
        let mut record = previous.clone().unwrap_or_else(|| ImageRecord {
            key: image.key.clone(),
            url: image.url.clone(),
            title_ids: Vec::new(),
            first_recorded_at: recorded_at.clone(),
            last_recorded_at: recorded_at.clone(),
            credits: Vec::new(),
        });
        if !record.title_ids.contains(&title.entry.id) {
            record.title_ids.push(title.entry.id.clone());
            record.title_ids.sort();
        }
        let same = |credit: &records::Credit| records::Credit { retrieved_at: None, ..credit.clone() } == records::Credit { retrieved_at: None, ..image.credit.clone() };
        match record.credits.iter_mut().find(|credit| same(credit)) {
            Some(credit) => credit.retrieved_at = image.credit.retrieved_at.clone().or(credit.retrieved_at.take()),
            None => record.credits.push(image.credit.clone()),
        }
        if previous.as_ref() != Some(&record) {
            record.last_recorded_at = recorded_at.clone();
            write_json(&path, &record)?;
        }
    }
    let name = utf8_percent_encode(&title.entry.id, NON_ALPHANUMERIC).to_string();
    let path = folder.join("titles").join(format!("{name}.json"));
    let snapshot = title_record(&title, &images, &recorded_at);
    let current = serde_json::to_value(&snapshot).map_err(AppError::internal)?;
    let previous: Option<serde_json::Value> = read_json(&path)?;
    let unchanged = previous.is_some_and(|mut previous| {
        previous["recorded_at"] = current["recorded_at"].clone();
        previous == current
    });
    if !unchanged {
        write_json(&path, &snapshot)?;
    }
    Ok(())
}

fn record_fetch(folder: &std::path::Path, event: &Fetched) -> AppResult<()> {
    let path = folder.join("images").join(format!("{}.json", event.key));
    let Some(mut record) = read_json::<ImageRecord>(&path)? else { return Ok(()) };
    let retrieved_at = iso(event.fetched_at);
    let mut changed = false;
    for credit in record.credits.iter_mut().filter(|credit| credit.source.is_some()) {
        if credit.retrieved_at.as_deref() != Some(retrieved_at.as_str()) {
            credit.retrieved_at = Some(retrieved_at.clone());
            changed = true;
        }
    }
    if changed {
        record.last_recorded_at = iso(now_ms());
        write_json(&path, &record)?;
    }
    Ok(())
}
