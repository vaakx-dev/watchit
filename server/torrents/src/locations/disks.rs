use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::Serialize;
use ts_rs::TS;

use super::volume::{free_bytes, root_of};
use crate::transfers::Transfers;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "torrents/", rename = "DiskUsage")]
pub struct Disk {
    pub root: String,
    pub used_bytes: u64,
    pub budget_bytes: Option<u64>,
    pub free_bytes: u64,
}

impl Transfers {
    pub fn used_by_drive(&self) -> BTreeMap<PathBuf, u64> {
        let mut used = BTreeMap::new();
        for entry in self.entries().values() {
            *used.entry(root_of(&entry.record.download_dir)).or_insert(0) += entry.progress().downloaded_bytes;
        }
        used
    }

    pub fn disks(&self) -> Vec<Disk> {
        let settings = self.settings();
        let mut drives = self.used_by_drive();
        drives.entry(root_of(&settings.download_dir)).or_insert(0);
        drives
            .into_iter()
            .map(|(root, used_bytes)| Disk {
                free_bytes: free_bytes(&root),
                root: root.to_string_lossy().into_owned(),
                used_bytes,
                budget_bytes: settings.disk_budget_bytes,
            })
            .collect()
    }
}
