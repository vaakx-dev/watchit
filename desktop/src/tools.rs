use std::env;
use std::path::PathBuf;

pub fn ffmpeg_dir() -> PathBuf {
    if let Some(dir) = env::var_os("WATCHIT_FFMPEG_DIR") {
        return PathBuf::from(dir);
    }
    env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("ffmpeg")))
        .filter(|dir| dir.join("ffmpeg.exe").exists())
        .unwrap_or_else(|| PathBuf::from(watchit_server::SOURCE_FFMPEG_DIR))
}
