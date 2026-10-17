use std::path::PathBuf;

use watchit_server::{Config, start};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into())).init();
    let data_dir = std::env::var_os("WATCHIT_DATA_DIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("data"));
    let listen = std::env::var("WATCHIT_LISTEN").unwrap_or_else(|_| "0.0.0.0:7171".into()).parse()?;
    let web_dir = std::env::var_os("WATCHIT_WEB_DIR").map(PathBuf::from);
    let ffmpeg_dir = std::env::var_os("WATCHIT_FFMPEG_DIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(watchit_server::SOURCE_FFMPEG_DIR));
    let server = start(Config { data_dir, listen, web_dir, ffmpeg_dir }).await?;
    tracing::info!(addr = %server.addr(), "watchit server listening");
    tokio::signal::ctrl_c().await?;
    server.shutdown().await;
    Ok(())
}
