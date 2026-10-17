mod magnet;
mod metadata;

use std::net::{Ipv6Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use librqbit::dht::DhtPersistenceConfig;
use librqbit::limits::LimitsConfig;
use librqbit::{DhtSessionConfig, ListenerMode, ListenerOptions, ManagedTorrentState, Session, SessionOptions, SessionPersistenceConfig};

pub use metadata::{AddRequest, Metadata, MetadataFile, add_resolved, files_of, resolve};

pub type Handle = Arc<librqbit::ManagedTorrent>;

pub fn session_folder(folder: &Path) -> PathBuf {
    folder.join("session")
}

pub fn bitfield_file(session_folder: &Path, info_hash: &str) -> PathBuf {
    session_folder.join(format!("{info_hash}.bitv"))
}

const STREAM_WORKER_THREADS: usize = 64;
const DHT_DUMP_INTERVAL: Duration = Duration::from_secs(60);
const FALLBACK_TRACKERS: [&str; 5] = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://explodie.org:6969/announce",
];

pub async fn start(folder: &Path, listen_port: Option<u16>, download_dir: &Path, limits: LimitsConfig) -> anyhow::Result<Arc<Session>> {
    let options = SessionOptions {
        fastresume: true,
        persistence: Some(SessionPersistenceConfig::Json { folder: Some(session_folder(folder)) }),
        dht: listen_port.map(|_| DhtSessionConfig {
            persistence: Some(DhtPersistenceConfig {
                dump_interval: Some(DHT_DUMP_INTERVAL),
                config_filename: Some(folder.join("dht.json")),
            }),
            ..Default::default()
        }),
        listen: listen_port.map(|port| ListenerOptions {
            mode: ListenerMode::TcpAndUtp,
            listen_addr: SocketAddr::from((Ipv6Addr::UNSPECIFIED, port)),
            ..Default::default()
        }),
        disable_local_service_discovery: listen_port.is_none(),
        runtime_worker_threads: Some(STREAM_WORKER_THREADS),
        ratelimits: limits,
        trackers: FALLBACK_TRACKERS.iter().map(|tracker| tracker.parse()).collect::<Result<_, _>>()?,
        ..Default::default()
    };
    Session::new_with_opts(download_dir.to_path_buf(), options).await
}

pub fn set_limits(session: &Session, limits: LimitsConfig) {
    session.ratelimits.set_download_bps(limits.download_bps);
    session.ratelimits.set_upload_bps(limits.upload_bps);
}

pub fn is_live(handle: &Handle) -> bool {
    handle.with_state(|state| matches!(state, ManagedTorrentState::Live(_)))
}

pub fn is_paused(handle: &Handle) -> bool {
    handle.with_state(|state| matches!(state, ManagedTorrentState::Paused(_)))
}
