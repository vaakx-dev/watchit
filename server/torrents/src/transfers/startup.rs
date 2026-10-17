use std::collections::HashSet;
use std::sync::Arc;

use librqbit::api::TorrentIdOrHash;
use watchit_core::AppResult;

use super::entry::Entry;
use super::{Transfers, pick, store};
use crate::engine::{self, Handle};
use crate::{locations, queue};

impl Transfers {
    pub async fn restore(self: &Arc<Self>) -> AppResult<()> {
        let (saved, ranks, mut library) =
            self.db.run(|conn| Ok((store::load(conn)?, queue::load_ranks(conn)?, locations::load_library(conn)?))).await?;
        let known: HashSet<String> = saved.iter().map(|(record, _)| record.info_hash.clone()).collect();
        let managed: Vec<Handle> = self.session.with_torrents(|torrents| torrents.map(|(_, handle)| handle.clone()).collect());
        for handle in managed.iter().filter(|handle| !known.contains(&handle.info_hash().as_string())) {
            if let Err(error) = self.session.delete(handle.id().into(), false).await {
                tracing::warn!(error = format!("{error:#}"), "could not drop an unknown torrent");
            }
        }

        let mut unresolved = Vec::new();
        for (record, files) in saved {
            let handle = TorrentIdOrHash::parse(&record.info_hash).ok().and_then(|id| self.session.get(id));
            let mut entry = Entry::new(record, files);
            entry.library = library.remove(&entry.record.info_hash).unwrap_or_default();
            entry.queue_rank = ranks.get(&entry.record.info_hash).copied().unwrap_or_else(|| queue::next_rank(&self.entries()));
            match handle {
                Some(handle) => {
                    if !entry.record.picks.is_empty() {
                        let available = engine::files_of(&handle).unwrap_or_default();
                        entry.files = pick::resolve(&entry.record.picks, &available, &entry.record.name, &entry.files);
                        entry.record.picks.clear();
                    }
                    entry.handle = Some(handle);
                }
                None => {
                    if !entry.files.is_empty() {
                        let indexes = entry.files.iter().map(|file| file.index).collect();
                        let title_id = entry.record.title_id.clone();
                        entry.record.picks.push(super::Pick { title_id, choice: super::Choice::Files { indexes } });
                    }
                    if entry.record.error.is_none() {
                        unresolved.push(entry.record.info_hash.clone());
                    }
                }
            }
            self.entries().insert(entry.record.info_hash.clone(), entry);
        }
        for hash in unresolved {
            self.fetch_metadata(&hash);
        }
        self.reconcile().await;
        Ok(())
    }
}
