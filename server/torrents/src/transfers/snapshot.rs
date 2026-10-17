use librqbit::TorrentStatsState;

use super::entry::{Entry, Progress};
use super::model::{State, Transfer, TransferFile};

fn ratio(part: u64, whole: u64) -> f64 {
    if whole == 0 { 0.0 } else { (part as f64 / whole as f64).min(1.0) }
}

fn state(entry: &Entry, progress: &Progress) -> State {
    let Some(engine) = progress.engine_state() else {
        return if entry.record.error.is_some() { State::Error } else { State::Metadata };
    };
    match engine {
        TorrentStatsState::Error => State::Error,
        _ if entry.record.paused => State::Paused,
        TorrentStatsState::Live if progress.finished() => State::Seeding,
        _ if progress.finished() => State::Completed,
        TorrentStatsState::Live | TorrentStatsState::Initializing { .. } => State::Downloading,
        TorrentStatsState::Paused => State::Queued,
    }
}

fn error(entry: &Entry, progress: &Progress, state: State) -> Option<String> {
    match state {
        State::Error => progress.stats.as_ref().and_then(|stats| stats.error.clone()).or_else(|| entry.record.error.clone()),
        State::Queued => entry.waiting.map(str::to_owned),
        _ => None,
    }
}

pub fn snapshot(entry: &Entry) -> Transfer {
    let progress = entry.progress();
    let state = state(entry, &progress);
    let live = progress.stats.as_ref().and_then(|stats| stats.live.as_ref());
    let running = matches!(state, State::Downloading | State::Seeding);
    let download_bps = live.filter(|_| running).map_or(0, |live| live.download_speed.as_bytes());
    let upload_bps = live.filter(|_| running).map_or(0, |live| live.upload_speed.as_bytes());
    let eta_seconds = (state == State::Downloading && download_bps > 0).then(|| progress.remaining().div_ceil(download_bps));
    let files = entry
        .files
        .iter()
        .zip(&progress.per_file)
        .map(|(file, (_, have))| TransferFile {
            index: file.index,
            name: file.name.clone(),
            size_bytes: file.size_bytes,
            progress: ratio(*have, file.size_bytes),
            title_id: file.title_id.clone(),
        })
        .collect();
    Transfer {
        id: entry.record.info_hash.clone(),
        info_hash: entry.record.info_hash.clone(),
        name: entry.record.name.clone(),
        title_id: entry.record.title_id.clone(),
        kind: entry.record.kind,
        state,
        error: error(entry, &progress, state),
        files,
        size_bytes: progress.size_bytes,
        downloaded_bytes: progress.downloaded_bytes,
        progress: ratio(progress.downloaded_bytes, progress.size_bytes),
        download_bps,
        upload_bps,
        peers: live.map_or(0, |live| live.snapshot.peer_stats.live),
        eta_seconds,
        added_at: entry.record.added_at,
        readiness: entry.readiness.current.clone(),
    }
}
