use std::net::SocketAddr;

use serde::Deserialize;

use super::cli;
use super::serve;
use super::types::{TailscaleState, TailscaleStatus};

#[derive(Deserialize)]
struct Node {
    #[serde(rename = "DNSName", default)]
    dns_name: String,
    #[serde(rename = "TailscaleIPs", default)]
    ips: Vec<String>,
}

#[derive(Deserialize)]
struct Status {
    #[serde(rename = "BackendState")]
    backend: String,
    #[serde(rename = "AuthURL", default)]
    auth_url: String,
    #[serde(rename = "Self")]
    this: Option<Node>,
    #[serde(rename = "CertDomains", default)]
    cert_domains: Option<Vec<String>>,
}

fn state(backend: &str, has_certificates: bool) -> TailscaleState {
    match backend {
        "NeedsLogin" => TailscaleState::NeedsLogin,
        "NeedsMachineAuth" => TailscaleState::NeedsApproval,
        "Stopped" => TailscaleState::Stopped,
        "Running" if has_certificates => TailscaleState::Ready,
        "Running" => TailscaleState::NoHttps,
        _ => TailscaleState::Connecting,
    }
}

fn describe(status: Status) -> TailscaleStatus {
    let domains = status.cert_domains.unwrap_or_default();
    let mut described = TailscaleStatus::new(state(&status.backend, !domains.is_empty()));
    described.login_url = Some(status.auth_url).filter(|url| !url.is_empty());
    if let Some(node) = status.this {
        described.name = domains.into_iter().next().or_else(|| Some(node.dns_name.trim_end_matches('.').to_owned())).filter(|name| !name.is_empty());
        described.ip = node.ips.into_iter().find(|ip| ip.parse::<std::net::Ipv4Addr>().is_ok());
    }
    described
}

pub async fn probe(listen: SocketAddr) -> TailscaleStatus {
    let Some(program) = cli::find() else { return TailscaleStatus::new(TailscaleState::Missing) };
    let status = cli::run(&program, &["status", "--json"]).await.ok().and_then(|output| serde_json::from_str::<Status>(&output.stdout).ok());
    let Some(status) = status else { return TailscaleStatus::new(TailscaleState::Stopped) };
    let mut described = describe(status);
    let running = matches!(described.state, TailscaleState::Ready | TailscaleState::NoHttps);
    if running
        && let Some(name) = &described.name
        && let Ok(output) = cli::run(&program, &["serve", "status", "--json"]).await
    {
        (described.sharing, described.public) = serve::classify(&output.stdout, name, &serve::target(listen));
    }
    described
}
