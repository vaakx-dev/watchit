pub fn magnet(info_hash: &str, trackers: &[String]) -> String {
    let mut url = format!("magnet:?xt=urn:btih:{info_hash}");
    for tracker in trackers {
        url.push_str("&tr=");
        url.push_str(&percent_encode(tracker));
    }
    url
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}
