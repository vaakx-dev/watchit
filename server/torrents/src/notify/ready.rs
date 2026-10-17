use serde::Serialize;
use ts_rs::TS;

use crate::transfers::Entry;
use crate::readiness::Verdict;
use crate::transfers::model::Transfer;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "torrents/", rename = "ReadyEvent")]
pub struct ReadyNotice {
    pub id: String,
    pub title_id: String,
    pub name: String,
}

pub(crate) fn take_due(entry: &mut Entry, current: &Transfer) -> Option<ReadyNotice> {
    if !entry.record.notify_when_ready || current.readiness.state != Verdict::Ready {
        return None;
    }
    entry.record.notify_when_ready = false;
    Some(ReadyNotice { id: current.id.clone(), title_id: current.title_id.clone(), name: current.name.clone() })
}
