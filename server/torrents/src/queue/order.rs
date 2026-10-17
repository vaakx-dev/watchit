use std::collections::HashMap;

use watchit_core::{AppError, AppResult};

use super::store::save_rank;
use crate::transfers::Transfers;
use crate::transfers::model::Kind;
use crate::transfers::{Entry, valid_info_hash};

fn in_line(entry: &Entry) -> bool {
    entry.record.kind == Kind::Download && !entry.progress().finished()
}

fn line(entries: &HashMap<String, Entry>) -> Vec<String> {
    let mut members: Vec<&Entry> = entries.values().filter(|entry| in_line(entry)).collect();
    members.sort_by_key(|entry| (entry.queue_rank, entry.record.added_at));
    members.into_iter().map(|entry| entry.record.info_hash.clone()).collect()
}

pub fn next_rank(entries: &HashMap<String, Entry>) -> i64 {
    entries.values().map(|entry| entry.queue_rank + 1).max().unwrap_or(0)
}

pub fn number(entries: &mut HashMap<String, Entry>) {
    let line = line(entries);
    for entry in entries.values_mut() {
        entry.queue_position = None;
    }
    for (position, hash) in line.iter().enumerate() {
        if let Some(entry) = entries.get_mut(hash) {
            entry.queue_position = Some(position as u32);
        }
    }
}

impl Transfers {
    pub async fn move_in_queue(&self, id: &str, position: u32) -> AppResult<()> {
        let info_hash = valid_info_hash(id)?;
        let ranks: Vec<(String, i64)> = {
            let mut entries = self.entries();
            let mut line = line(&entries);
            let from = line
                .iter()
                .position(|hash| *hash == info_hash)
                .ok_or_else(|| AppError::bad_request("Only downloads that haven't finished have a place in the queue."))?;
            let hash = line.remove(from);
            line.insert((position as usize).min(line.len()), hash);
            line.into_iter()
                .zip(0..)
                .filter_map(|(hash, rank)| {
                    entries.get_mut(&hash)?.queue_rank = rank;
                    Some((hash, rank))
                })
                .collect()
        };
        self.db
            .run(move |conn| {
                let tx = conn.transaction()?;
                for (hash, rank) in &ranks {
                    save_rank(&tx, hash, *rank)?;
                }
                tx.commit()?;
                Ok(())
            })
            .await?;
        self.wake();
        Ok(())
    }
}
