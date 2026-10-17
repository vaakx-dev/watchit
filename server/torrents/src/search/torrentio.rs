use std::sync::LazyLock;
use std::time::Duration;

use regex::Regex;
use serde::Deserialize;
use watchit_core::{AppError, AppResult};

use super::languages;
use super::result::{Candidate, TorrentResult, Traits};
use crate::release::{Hdr, Resolution, audio, episode, video};
use crate::title_id::TitleId;

const ADDON: &str = "https://torrentio.strem.fun";
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Deserialize)]
struct Response {
    #[serde(default)]
    streams: Vec<Stream>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Stream {
    #[serde(default)]
    name: String,
    #[serde(default)]
    title: String,
    info_hash: Option<String>,
    file_idx: Option<usize>,
    behavior_hints: Option<BehaviorHints>,
    #[serde(default)]
    sources: Vec<String>,
}

#[derive(Deserialize)]
struct BehaviorHints {
    filename: Option<String>,
}

static SEEDERS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"👤\s*(\d+)").expect("valid seeders regex"));
static SIZE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"💾\s*([\d.]+)\s*(B|kB|KB|MB|GB|TB)\b").expect("valid size regex"));
static SITE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"⚙\u{FE0F}?\s*(.+?)\s*$").expect("valid site regex"));

pub async fn streams(http: &reqwest::Client, title: &TitleId) -> AppResult<Vec<Candidate>> {
    let kind = if title.is_episode() { "series" } else { "movie" };
    let url = format!("{ADDON}/stream/{kind}/{title}.json");
    let response = http.get(url).timeout(TIMEOUT).send().await.map_err(|_| unavailable("Torrent search is unavailable."))?;
    if !response.status().is_success() {
        return Err(unavailable(&format!("Torrent search failed with HTTP {}.", response.status().as_u16())));
    }
    let body: Response = response.json().await.map_err(|_| unavailable("Torrent search returned an unreadable response."))?;
    Ok(body.streams.into_iter().filter_map(|stream| candidate(stream, title)).collect())
}

fn unavailable(message: &str) -> AppError {
    AppError::new(axum::http::StatusCode::BAD_GATEWAY, message)
}

fn candidate(stream: Stream, title: &TitleId) -> Option<Candidate> {
    let info_hash = stream.info_hash?.to_ascii_lowercase();
    if info_hash.len() != 40 || !info_hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let lines: Vec<&str> = stream.title.lines().map(str::trim).collect();
    let stats_at = lines.iter().position(|line| line.contains('👤') || line.contains('💾') || line.contains('⚙'));
    let stats = stats_at.map_or("", |at| lines[at]);
    let language_line = stats_at.and_then(|at| lines.get(at + 1)).copied().filter(|line| languages::is_flag_line(line));
    let torrent_name = lines.first().copied().unwrap_or_default().to_owned();
    let file_path = stats_at.filter(|at| *at > 1).map(|at| lines[1..at].join(" "));
    let filename = stream.behavior_hints.and_then(|hints| hints.filename);
    let label = stream.name.lines().skip(1).collect::<Vec<_>>().join(" ");
    let text = [Some(torrent_name.as_str()), file_path.as_deref(), filename.as_deref()].into_iter().flatten().collect::<Vec<_>>().join(" ");

    let resolution = label_resolution(&label).or_else(|| video::resolution(&text));
    let hdr = merged_hdr(&label, &text);
    let traits = Traits {
        dolby_vision_without_fallback: video::dolby_vision_without_fallback(&text, &hdr),
        remux: video::is_remux(&text) || label.contains("REMUX"),
        disc_image: video::is_disc_image(&text),
        cam: video::is_cam(&torrent_name) || matches!(label.split(' ').next(), Some("CAM" | "TeleSync" | "TeleCine" | "SCR")),
        three_d: video::is_3d(&label) || video::is_3d(&torrent_name),
    };
    let season_pack = match title {
        TitleId::Episode { season, .. } => episode::coverage(&torrent_name).is_pack_for(*season),
        TitleId::Title(_) => false,
    };
    let trackers = stream.sources.iter().filter_map(|source| source.strip_prefix("tracker:")).map(str::to_owned).collect();
    Some(Candidate {
        result: TorrentResult {
            info_hash,
            file_index: stream.file_idx,
            name: torrent_name,
            filename,
            resolution,
            hdr,
            video_codec: video::codec(&text).map(str::to_owned),
            audio: audio::audio(&text),
            size_bytes: size_bytes(stats),
            seeders: SEEDERS.captures(stats).and_then(|found| found[1].parse().ok()),
            site: SITE.captures(stats).map(|found| found[1].to_owned()),
            languages: language_line.map(languages::from_flags).unwrap_or_default(),
            season_pack,
        },
        traits,
        trackers,
    })
}

fn label_resolution(label: &str) -> Option<Resolution> {
    match label.split(' ').next()?.to_ascii_lowercase().as_str() {
        "4k" | "2160p" => Some(Resolution::Uhd),
        "2k" | "1440p" => Some(Resolution::Qhd),
        "1080p" => Some(Resolution::FullHd),
        "720p" => Some(Resolution::Hd),
        "576p" | "480p" => Some(Resolution::Sd),
        "360p" | "240p" | "144p" => Some(Resolution::Low),
        _ => None,
    }
}

fn merged_hdr(label: &str, text: &str) -> Vec<Hdr> {
    let mut hdr = video::hdr(text);
    for tag in label.split([' ', '|']).filter(|tag| !tag.is_empty()) {
        let found = match tag {
            "DV" => Hdr::DolbyVision,
            "HDR10+" => Hdr::Hdr10Plus,
            "HDR" => Hdr::Hdr10,
            _ => continue,
        };
        if !hdr.contains(&found) {
            hdr.push(found);
        }
    }
    hdr.sort();
    hdr
}

fn size_bytes(stats: &str) -> Option<u64> {
    let found = SIZE.captures(stats)?;
    let value: f64 = found[1].parse().ok()?;
    let unit: f64 = match &found[2] {
        "B" => 1.0,
        "kB" | "KB" => 1024.0,
        "MB" => 1024f64.powi(2),
        "GB" => 1024f64.powi(3),
        _ => 1024f64.powi(4),
    };
    Some((value * unit).round() as u64)
}
