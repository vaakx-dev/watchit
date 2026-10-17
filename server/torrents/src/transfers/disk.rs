use std::path::Path;

use serde::Serialize;
use ts_rs::TS;

use super::Transfers;

#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export_to = "torrents/", rename = "DiskUsage")]
pub struct Disk {
    pub used_bytes: u64,
    pub budget_bytes: Option<u64>,
    pub free_bytes: u64,
}

pub fn free_bytes(folder: &Path) -> u64 {
    fs4::available_space(folder).unwrap_or(0)
}

impl Transfers {
    pub fn used_bytes(&self) -> u64 {
        self.entries().values().map(|entry| entry.progress().downloaded_bytes).sum()
    }

    pub fn disk(&self) -> Disk {
        let settings = self.settings();
        Disk { used_bytes: self.used_bytes(), budget_bytes: settings.disk_budget_bytes, free_bytes: free_bytes(settings.download_dir()) }
    }
}
