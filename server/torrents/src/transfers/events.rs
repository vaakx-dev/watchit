use super::Transfers;
use super::model::Transfer;
use super::snapshot::snapshot;
use crate::notify::{ReadyNotice, take_due};

#[derive(Clone, Debug)]
pub enum TransferEvent {
    Changed(Transfer),
    Removed { id: String },
    Ready(ReadyNotice),
}

impl Transfers {
    pub fn emit_changes(&self) {
        let mut ready = Vec::new();
        let changed: Vec<Transfer> = self
            .entries()
            .values_mut()
            .filter_map(|entry| {
                let mut current = snapshot(entry);
                if let Some(notice) = take_due(entry, &current) {
                    ready.push(notice);
                    current = snapshot(entry);
                }
                if entry.sent.as_ref() == Some(&current) {
                    return None;
                }
                entry.sent = Some(current.clone());
                Some(current)
            })
            .collect();
        for transfer in changed {
            let _ = self.events.send(TransferEvent::Changed(transfer));
        }
        for notice in ready {
            let _ = self.events.send(TransferEvent::Ready(notice));
        }
    }

    pub fn emit_removed(&self, id: &str) {
        let _ = self.events.send(TransferEvent::Removed { id: id.to_owned() });
    }

    pub fn transfer(&self, info_hash: &str) -> Option<Transfer> {
        self.entries().get(info_hash).map(snapshot)
    }

    pub fn all(&self) -> Vec<Transfer> {
        let mut transfers: Vec<Transfer> = self.entries().values().map(snapshot).collect();
        transfers.sort_by_key(|transfer| std::cmp::Reverse(transfer.added_at));
        transfers
    }
}
