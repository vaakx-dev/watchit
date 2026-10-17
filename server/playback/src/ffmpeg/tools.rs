use std::path::{Path, PathBuf};

use tokio::process::Command;

pub const SOURCE_FFMPEG_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/resources/ffmpeg");

#[derive(Clone, Debug)]
pub struct Tools {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
}

impl Tools {
    pub fn in_dir(dir: &Path) -> Self {
        Self { ffmpeg: dir.join("ffmpeg.exe"), ffprobe: dir.join("ffprobe.exe") }
    }


    pub fn ffmpeg(&self) -> Command {
        quiet(&self.ffmpeg)
    }

    pub fn ffprobe(&self) -> Command {
        quiet(&self.ffprobe)
    }
}

fn quiet(program: &Path) -> Command {
    let mut command = Command::new(program);
    command.kill_on_drop(true).stdin(std::process::Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    command
}
