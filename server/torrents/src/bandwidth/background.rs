use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;

use librqbit::limits::LimitsConfig;

use crate::engine::Handle;
use crate::queue::Slot;
use crate::transfers::Entry;

const PAUSED_WHILE_WATCHING: &str = "Paused while you're watching.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Background {
    Free,
    Paused,
    Limited(u32),
}

fn share(background: Background, active: u32) -> Option<NonZeroU32> {
    match background {
        Background::Limited(bps) => NonZeroU32::new((bps / active.max(1)).max(1)),
        Background::Free | Background::Paused => None,
    }
}

pub fn steer_background(entries: &mut HashMap<String, Entry>, background: Background) -> Vec<(Handle, LimitsConfig)> {
    let active = entries.values().filter(|entry| entry.slot == Slot::Active).count() as u32;
    let mut changes = Vec::new();
    for entry in entries.values_mut() {
        let is_background = entry.slot == Slot::Active;
        if is_background && background == Background::Paused {
            entry.slot = Slot::Queued(Some(PAUSED_WHILE_WATCHING));
        }
        let (Some(handle), Some(view)) = (&entry.handle, &entry.engine) else { continue };
        let wanted = LimitsConfig { download_bps: share(background, active).filter(|_| is_background), upload_bps: None };
        if view.limits != wanted {
            changes.push((Arc::clone(handle), wanted));
        }
    }
    changes
}
