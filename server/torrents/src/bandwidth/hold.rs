use std::collections::HashMap;

use crate::queue::Slot;
use crate::transfers::Entry;

pub fn hold_background(entries: &mut HashMap<String, Entry>, reason: &'static str) {
    for entry in entries.values_mut().filter(|entry| entry.slot == Slot::Active) {
        entry.slot = Slot::Queued(Some(reason));
    }
}
