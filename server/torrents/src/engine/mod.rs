mod magnet;
mod metadata;

use std::net::{Ipv6Addr, SocketAddr};
use std::num::NonZeroU32;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use librqbit::dht::DhtPersistenceConfig;
use librqbit::limits::LimitsConfig;
use librqbit::{DhtSessionConfig, ListenerMode, ListenerOptions, Session, SessionOptions, SessionPersistenceConfig};

pub use metadata::{AddRequest, Metadata, MetadataFile, add_resolved, files_of, resolve};

use crate::settings::Settings;

pub type Handle = Arc<librqbit::ManagedTorrent>;

const STREAM_WORKER_THREADS: usize = 64;
const DHT_DUMP_INTERVAL: Duration = Duration::from_secs(60);
const FALLBACK_TRACKERS: [&str; 5] = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://explodie.org:6969/announce",
];

pub async fn start(folder: &Path, listen_port: u16, settings: &Settings) -> anyhow::Result<Arc<Session>> {
    let options = SessionOptions {
        fastresume: true,
        persistence: Some(SessionPersistenceConfig::Json { folder: Some(folder.join("session")) }),
        dht: Some(DhtSessionConfig {
            persistence: Some(DhtPersistenceConfig {
                dump_interval: Some(DHT_DUMP_INTERVAL),
                config_filename: Some(folder.join("dht.json")),
            }),
            ..Default::default()
        }),
        listen: Some(ListenerOptions {
            mode: ListenerMode::TcpAndUtp,
            listen_addr: SocketAddr::from((Ipv6Addr::UNSPECIFIED, listen_port)),
            ..Default::default()
        }),
        runtime_worker_threads: Some(STREAM_WORKER_THREADS),
        ratelimits: limits(settings),
        trackers: FALLBACK_TRACKERS.iter().map(|tracker| tracker.parse()).collect::<Result<_, _>>()?,
        ..Default::default()
    };
    Session::new_with_opts(settings.download_dir().to_path_buf(), options).await
}

pub fn limits(settings: &Settings) -> LimitsConfig {
    LimitsConfig {
        download_bps: settings.max_download_bps.and_then(NonZeroU32::new),
        upload_bps: settings.max_upload_bps.and_then(NonZeroU32::new),
    }
}

pub fn apply_limits(session: &Session, settings: &Settings) {
    let limits = limits(settings);
    session.ratelimits.set_download_bps(limits.download_bps);
    session.ratelimits.set_upload_bps(limits.upload_bps);
}
