use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};

pub struct Lan {
    pub label: String,
    pub ip: Ipv4Addr,
    pub preferred: bool,
}

fn outbound() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) => Some(ip),
        IpAddr::V6(_) => None,
    }
}

pub fn is_tailnet(ip: Ipv4Addr) -> bool {
    let [first, second, ..] = ip.octets();
    first == 100 && (64..128).contains(&second)
}

fn reachable(ip: Ipv4Addr, listen: SocketAddr) -> bool {
    !ip.is_loopback()
        && !ip.is_link_local()
        && !ip.is_unspecified()
        && !is_tailnet(ip)
        && (listen.ip().is_unspecified() || listen.ip() == IpAddr::V4(ip))
}

pub fn lan(listen: SocketAddr) -> Vec<Lan> {
    let primary = outbound();
    let mut found: Vec<Lan> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|interface| match interface.ip() {
            IpAddr::V4(ip) if reachable(ip, listen) => Some(Lan {
                label: interface.name,
                ip,
                preferred: Some(ip) == primary,
            }),
            _ => None,
        })
        .collect();
    found.sort_by_key(|lan| !lan.preferred);
    found
}
