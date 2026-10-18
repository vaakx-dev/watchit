use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::locations::free_bytes;
use crate::settings::Settings;

const WAITING_FOR_BUDGET: &str = "Waiting for room in the disk budget.";
const WAITING_FOR_DISK: &str = "Waiting for free disk space.";

struct Room {
    budget: Option<u64>,
    disk: u64,
}

pub struct Admission {
    slots: u32,
    budget_bytes: Option<u64>,
    used: HashMap<PathBuf, u64>,
    drives: HashMap<PathBuf, Room>,
}

impl Admission {
    pub fn new(settings: &Settings, used: HashMap<PathBuf, u64>) -> Self {
        Self {
            slots: settings.max_active,
            budget_bytes: settings.disk_budget_bytes,
            used,
            drives: HashMap::new(),
        }
    }

    fn room(&mut self, drive: &Path) -> &mut Room {
        let used = self.used.get(drive).copied().unwrap_or(0);
        let budget = self.budget_bytes.map(|budget| budget.saturating_sub(used));
        self.drives.entry(drive.to_path_buf()).or_insert_with(|| Room {
            budget,
            disk: free_bytes(drive),
        })
    }

    pub fn admit(&mut self, drive: &Path, remaining: u64) -> Result<(), Option<&'static str>> {
        if self.slots == 0 {
            return Err(None);
        }
        let room = self.room(drive);
        if room.budget.is_some_and(|budget| remaining > budget) {
            return Err(Some(WAITING_FOR_BUDGET));
        }
        if remaining > room.disk {
            return Err(Some(WAITING_FOR_DISK));
        }
        room.budget = room.budget.map(|budget| budget - remaining);
        room.disk -= remaining;
        self.slots -= 1;
        Ok(())
    }
}
