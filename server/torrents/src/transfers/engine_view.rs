use std::collections::BTreeSet;
use std::sync::Arc;

use librqbit::TorrentStats;
use librqbit::limits::LimitsConfig;

use super::Transfers;
use crate::engine::Handle;

pub struct EngineView {
    pub stats: Arc<TorrentStats>,
    pub only_files: Option<BTreeSet<usize>>,
    pub limits: LimitsConfig,
}

impl EngineView {
    fn read(handle: &Handle) -> Self {
        Self {
            stats: Arc::new(handle.stats()),
            only_files: handle.only_files().map(|files| files.into_iter().collect()),
            limits: handle.ratelimits(),
        }
    }
}

impl Transfers {
    pub async fn refresh_engine(&self) {
        let handles: Vec<(String, Handle)> = self
            .entries()
            .iter()
            .filter_map(|(hash, entry)| Some((hash.clone(), entry.handle.clone()?)))
            .collect();
        let read = tokio::task::spawn_blocking(move || {
            handles
                .into_iter()
                .map(|(hash, handle)| (hash, EngineView::read(&handle), handle))
                .collect::<Vec<_>>()
        })
        .await;
        let Ok(read) = read else { return };
        let mut entries = self.entries();
        for (hash, view, handle) in read {
            let Some(entry) = entries.get_mut(&hash) else { continue };
            if entry.handle.as_ref().is_some_and(|current| Arc::ptr_eq(current, &handle)) {
                entry.engine = Some(view);
            }
        }
    }
}
