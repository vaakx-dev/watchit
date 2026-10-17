use super::Transfers;
use super::model::Transfer;
use super::snapshot::snapshot;
use crate::queue;

#[derive(Clone, Debug)]
pub enum TransferEvent {
    Changed(Transfer),
    Removed { id: String },
}

impl Transfers {
    pub fn emit_changes(&self) {
        let mut entries = self.entries();
        queue::number(&mut entries);
        let changed: Vec<Transfer> = entries
            .values_mut()
            .filter_map(|entry| {
                let current = snapshot(entry);
                if entry.sent.as_ref() == Some(&current) {
                    return None;
                }
                entry.sent = Some(current.clone());
                Some(current)
            })
            .collect();
        drop(entries);
        for transfer in changed {
            let _ = self.events.send(TransferEvent::Changed(transfer));
        }
    }

    pub fn emit_removed(&self, id: &str) {
        let _ = self.events.send(TransferEvent::Removed { id: id.to_owned() });
    }

    pub fn transfer(&self, info_hash: &str) -> Option<Transfer> {
        let mut entries = self.entries();
        queue::number(&mut entries);
        entries.get(info_hash).map(snapshot)
    }

    pub fn all(&self) -> Vec<Transfer> {
        let mut entries = self.entries();
        queue::number(&mut entries);
        let mut transfers: Vec<Transfer> = entries.values().map(snapshot).collect();
        drop(entries);
        transfers.sort_by_key(|transfer| std::cmp::Reverse(transfer.added_at));
        transfers
    }
}
