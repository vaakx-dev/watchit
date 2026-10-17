use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;
use watchit_core::{AppError, AppResult};

const WAIT: Duration = Duration::from_secs(15);
#[cfg(windows)]
const NO_WINDOW: u32 = 0x0800_0000;

fn executable() -> &'static str {
    if cfg!(windows) { "tailscale.exe" } else { "tailscale" }
}

fn install_locations() -> Vec<PathBuf> {
    if cfg!(windows) {
        ["ProgramFiles", "ProgramFiles(x86)"]
            .into_iter()
            .filter_map(std::env::var_os)
            .map(|root| PathBuf::from(root).join("Tailscale").join("tailscale.exe"))
            .collect()
    } else if cfg!(target_os = "macos") {
        vec![PathBuf::from("/Applications/Tailscale.app/Contents/MacOS/Tailscale")]
    } else {
        vec![PathBuf::from("/usr/bin/tailscale"), PathBuf::from("/usr/local/bin/tailscale")]
    }
}

fn on_path() -> Vec<PathBuf> {
    let path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&path).map(|directory| directory.join(executable())).collect()
}

pub fn find() -> Option<PathBuf> {
    on_path().into_iter().chain(install_locations()).find(|candidate| candidate.is_file())
}

pub struct Output {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

pub async fn run(program: &PathBuf, args: &[&str]) -> AppResult<Output> {
    let mut command = Command::new(program);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(NO_WINDOW);
    let output = timeout(WAIT, command.output())
        .await
        .map_err(|_| AppError::internal("Tailscale did not answer in time."))?
        .map_err(|error| AppError::internal(format!("Could not run Tailscale: {error}")))?;
    Ok(Output {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
    })
}
