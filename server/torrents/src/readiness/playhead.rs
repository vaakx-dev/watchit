use std::sync::{Arc, Mutex};

use crate::transfers::Transfers;

const COMMIT_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Copy, Debug)]
pub struct Position {
    pub file: usize,
    pub offset: u64,
}

#[derive(Clone, Default)]
pub struct Slot(Arc<Mutex<Option<Position>>>);

impl Slot {
    pub fn get(&self) -> Option<Position> {
        *self.0.lock().expect("playhead lock")
    }

    pub fn cursor(&self, file: usize, start: u64) -> Cursor {
        Cursor {
            slot: self.clone(),
            file,
            start,
            served: 0,
        }
    }

    fn set(&self, position: Position) {
        *self.0.lock().expect("playhead lock") = Some(position);
    }
}

pub struct Cursor {
    slot: Slot,
    file: usize,
    start: u64,
    served: u64,
}

impl Cursor {
    pub fn advance(&mut self, bytes: u64) {
        self.served += bytes;
        if self.served >= COMMIT_BYTES {
            self.slot.set(Position {
                file: self.file,
                offset: self.start + self.served,
            });
        }
    }
}

impl Transfers {
    pub fn playhead_cursor(&self, info_hash: &str, file: usize, start: u64) -> Option<Cursor> {
        self.entries().get(info_hash).map(|entry| entry.readiness.playhead.cursor(file, start))
    }
}
