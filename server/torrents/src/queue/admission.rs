use crate::settings::Settings;
use crate::transfers::free_bytes;

const WAITING_FOR_BUDGET: &str = "Waiting for room in the disk budget.";
const WAITING_FOR_DISK: &str = "Waiting for free disk space.";

pub struct Admission {
    slots: u32,
    budget_room: Option<u64>,
    disk_room: u64,
}

impl Admission {
    pub fn new(settings: &Settings, used_bytes: u64) -> Self {
        Self {
            slots: settings.max_active,
            budget_room: settings.disk_budget_bytes.map(|budget| budget.saturating_sub(used_bytes)),
            disk_room: free_bytes(settings.download_dir()),
        }
    }

    pub fn admit(&mut self, remaining: u64) -> Result<(), Option<&'static str>> {
        if self.slots == 0 {
            return Err(None);
        }
        if self.budget_room.is_some_and(|room| remaining > room) {
            return Err(Some(WAITING_FOR_BUDGET));
        }
        if remaining > self.disk_room {
            return Err(Some(WAITING_FOR_DISK));
        }
        self.slots -= 1;
        self.budget_room = self.budget_room.map(|room| room - remaining);
        self.disk_room -= remaining;
        Ok(())
    }
}
