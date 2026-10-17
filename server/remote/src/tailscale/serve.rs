use std::net::{IpAddr, SocketAddr};

use serde_json::Value;

use super::types::Sharing;

pub const HTTPS_PORT: u16 = 443;

pub fn target(listen: SocketAddr) -> String {
    let host = match listen.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() || ip.is_loopback() => "127.0.0.1".to_owned(),
        IpAddr::V6(ip) if ip.is_unspecified() || ip.is_loopback() => "127.0.0.1".to_owned(),
        IpAddr::V4(ip) => ip.to_string(),
        IpAddr::V6(ip) => format!("[{ip}]"),
    };
    format!("http://{host}:{}", listen.port())
}

pub fn classify(serve_status: &str, name: &str, target: &str) -> (Sharing, bool) {
    let Ok(config) = serde_json::from_str::<Value>(serve_status) else { return (Sharing::Off, false) };
    let host_port = format!("{name}:{HTTPS_PORT}");
    let public = config["AllowFunnel"][&host_port].as_bool().unwrap_or(false);
    let proxy = config["Web"][&host_port]["Handlers"]["/"]["Proxy"].as_str();
    let sharing = match proxy {
        Some(proxy) if proxy.trim_end_matches('/') == target => Sharing::On,
        _ if config["Web"][&host_port].is_object() || config["TCP"][HTTPS_PORT.to_string()].is_object() => Sharing::Elsewhere,
        _ => Sharing::Off,
    };
    (sharing, public && sharing == Sharing::On)
}
