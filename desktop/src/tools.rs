use std::env;

const FFMPEG_DIR: &str = "WATCHIT_FFMPEG_DIR";

pub fn use_bundled_ffmpeg() {
    if env::var_os(FFMPEG_DIR).is_some() {
        return;
    }
    let Some(dir) = env::current_exe().ok().and_then(|exe| exe.parent().map(|dir| dir.join("ffmpeg"))) else {
        return;
    };
    if dir.join("ffmpeg.exe").exists() {
        unsafe { env::set_var(FFMPEG_DIR, dir) };
    }
}
