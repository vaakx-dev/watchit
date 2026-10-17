use serde::Serialize;
use ts_rs::TS;

use crate::address;
use crate::qr;
use crate::tailscale::{self, Sharing, TailscaleStatus};
use crate::Remote;

#[derive(Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export_to = "remote/")]
pub enum AddressKind {
    Lan,
    Tailscale,
}

#[derive(Serialize, TS)]
#[ts(export_to = "remote/")]
pub struct Address {
    pub kind: AddressKind,
    pub label: String,
    pub url: String,
    pub secure: bool,
    pub preferred: bool,
    pub qr: Option<String>,
}

#[derive(Serialize, TS)]
#[ts(export_to = "remote/")]
pub struct RemoteStatus {
    pub network: bool,
    pub manage: bool,
    pub port: u16,
    pub addresses: Vec<Address>,
    pub tailscale: TailscaleStatus,
}

fn address(kind: AddressKind, label: String, url: String, secure: bool, preferred: bool) -> Address {
    let qr = qr::svg_for(&url);
    Address { kind, label, url, secure, preferred, qr }
}

fn tailnet_addresses(tailscale: &TailscaleStatus, network: bool, port: u16) -> Vec<Address> {
    let mut found = Vec::new();
    if let (Some(name), Sharing::On) = (&tailscale.name, tailscale.sharing) {
        found.push(address(AddressKind::Tailscale, "Tailscale".into(), format!("https://{name}"), true, true));
    }
    if let (Some(ip), true) = (&tailscale.ip, network) {
        found.push(address(AddressKind::Tailscale, "Tailscale, no HTTPS".into(), format!("http://{ip}:{port}"), false, false));
    }
    found
}

impl Remote {
    fn network(&self) -> bool {
        !self.listen.ip().is_loopback()
    }

    fn lan_addresses(&self) -> Vec<Address> {
        let port = self.listen.port();
        address::lan(self.listen)
            .into_iter()
            .map(|lan| address(AddressKind::Lan, lan.label, format!("http://{}:{port}", lan.ip), false, lan.preferred))
            .collect()
    }

    pub async fn status(&self, manage: bool) -> RemoteStatus {
        let tailscale = tailscale::probe(self.listen).await;
        let port = self.listen.port();
        let mut addresses = tailnet_addresses(&tailscale, self.network(), port);
        if self.network() {
            addresses.extend(self.lan_addresses());
        }
        RemoteStatus { network: self.network(), manage, port, addresses, tailscale }
    }
}
