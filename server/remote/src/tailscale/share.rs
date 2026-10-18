use std::net::SocketAddr;

use watchit_core::{AppError, AppResult};

use super::cli;
use super::probe::probe;
use super::serve::{HTTPS_PORT, target};
use super::types::{Sharing, TailscaleState};

fn failure(output: cli::Output) -> AppError {
    let message = if output.stderr.is_empty() {
        output.stdout.trim().to_owned()
    } else {
        output.stderr
    };
    AppError::internal(if message.is_empty() {
        "Tailscale refused the change.".to_owned()
    } else {
        message
    })
}

pub async fn set_sharing(listen: SocketAddr, enabled: bool) -> AppResult<()> {
    let program = cli::find().ok_or_else(|| AppError::bad_request("Tailscale is not installed on this PC."))?;
    let current = probe(listen).await;
    let https = format!("--https={HTTPS_PORT}");
    let target = target(listen);
    let output = if enabled {
        if current.state != TailscaleState::Ready {
            return Err(AppError::bad_request(
                "Tailscale is not ready to share. Sign in and enable HTTPS certificates first.",
            ));
        }
        if current.sharing == Sharing::Elsewhere {
            return Err(AppError::bad_request(
                "Tailscale already serves something else on HTTPS port 443. Turn that off first.",
            ));
        }
        cli::run(&program, &["serve", "--bg", &https, &target]).await.map_err(|_| {
            AppError::internal(format!(
                "Tailscale is waiting for approval. Run `tailscale serve --bg {target}` in a terminal once, follow its link, then try again."
            ))
        })?
    } else {
        if current.sharing != Sharing::On {
            return Err(AppError::bad_request("Watchit is not shared through Tailscale."));
        }
        cli::run(&program, &["serve", &https, "off"]).await?
    };
    if output.success { Ok(()) } else { Err(failure(output)) }
}
