use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub enum Resolution {
    #[serde(rename = "2160p")]
    Uhd,
    #[serde(rename = "1080p")]
    FullHd,
    #[serde(rename = "720p")]
    Hd,
    #[serde(rename = "480p")]
    Sd,
}

impl Resolution {
    pub fn label(self) -> &'static str {
        match self {
            Self::Uhd => "2160p",
            Self::FullHd => "1080p",
            Self::Hd => "720p",
            Self::Sd => "480p",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub enum Hdr {
    #[serde(rename = "DV")]
    DolbyVision,
    #[serde(rename = "HDR10+")]
    Hdr10Plus,
    #[serde(rename = "HDR10")]
    Hdr10,
    #[serde(rename = "HLG")]
    Hlg,
}

impl Hdr {
    pub fn label(self) -> &'static str {
        match self {
            Self::DolbyVision => "DV",
            Self::Hdr10Plus => "HDR10+",
            Self::Hdr10 => "HDR10",
            Self::Hlg => "HLG",
        }
    }
}

fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid release regex")
}

static UHD: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b4k\b|21600?[pi]|\b3840x\d{4}\b|\buhd\b"));
static FULL_HD: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)10800?[pi]|\b1920x\d{3,4}\b|\bfhd\b"));
static HD: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b7200?[pi]\b|\b1280x\d{3}\b"));
static SD: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b480[pi]\b"));

static DOLBY_VISION: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b(dv|dovi|dolby[ .]?v(ision)?)\b"));
static HDR10_PLUS: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bhdr10(\+|p(lus)?\b)"));
static HDR10: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bhdr(10)?\b"));
static HLG: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bhlg\b"));
static WEB_SOURCE: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bweb[ ._-]?(dl|rip)?\b"));
static HULU: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bhulu\b"));

static HEVC: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b[xh][ .-]?265\b|\bhevc\b"));
static AVC: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b[xh][ .-]?264\b|\bavc\b"));
static AV1: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bav1\b"));
static VP9: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bvp9\b"));
static XVID: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b(xvid|divx)\b"));
static MPEG2: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\bmpeg-?2\b"));

static REMUX: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)remux"));
static DISC_IMAGE: LazyLock<Regex> = LazyLock::new(|| {
    regex(r"(?i)\.iso$|\b(iso|bdmv|bd25|bd50|bd66|bd100)\b|\bcomplete[ .-]+(uhd[ .-]+)?blu-?ray\b")
});
static CAM: LazyLock<Regex> = LazyLock::new(|| {
    regex(r"(?i)\b(cam|camrip|hdcam|ts|hdts|telesync|tc|telecine|scr|screener|dvdscr)\b")
});
static THREE_D: LazyLock<Regex> = LazyLock::new(|| regex(r"(?i)\b3d\b"));

pub fn resolution(text: &str) -> Option<Resolution> {
    [(&UHD, Resolution::Uhd), (&FULL_HD, Resolution::FullHd), (&HD, Resolution::Hd), (&SD, Resolution::Sd)]
        .into_iter()
        .find(|(pattern, _)| pattern.is_match(text))
        .map(|(_, resolution)| resolution)
}

pub fn hdr(text: &str) -> Vec<Hdr> {
    let mut found = Vec::new();
    if DOLBY_VISION.is_match(text) {
        found.push(Hdr::DolbyVision);
    }
    if HDR10_PLUS.is_match(text) {
        found.push(Hdr::Hdr10Plus);
    }
    if HDR10.is_match(&HDR10_PLUS.replace_all(text, " ")) {
        found.push(Hdr::Hdr10);
    }
    if HLG.is_match(text) {
        found.push(Hdr::Hlg);
    }
    found
}

pub fn dolby_vision_without_fallback(text: &str, hdr: &[Hdr]) -> bool {
    hdr == [Hdr::DolbyVision] && WEB_SOURCE.is_match(text) && !HULU.is_match(text)
}

pub fn codec(text: &str) -> Option<&'static str> {
    [(&HEVC, "HEVC"), (&AVC, "AVC"), (&AV1, "AV1"), (&VP9, "VP9"), (&XVID, "XviD"), (&MPEG2, "MPEG-2")]
        .into_iter()
        .find(|(pattern, _)| pattern.is_match(text))
        .map(|(_, name)| name)
}

pub fn is_remux(text: &str) -> bool {
    REMUX.is_match(text)
}

pub fn is_disc_image(text: &str) -> bool {
    DISC_IMAGE.is_match(text)
}

pub fn is_cam(text: &str) -> bool {
    CAM.is_match(text)
}

pub fn is_3d(text: &str) -> bool {
    THREE_D.is_match(text)
}
