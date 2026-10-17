use std::sync::LazyLock;

use regex::Regex;

struct Format {
    name: &'static str,
    pattern: Regex,
}

fn format(name: &'static str, pattern: &str) -> Format {
    Format { name, pattern: Regex::new(pattern).expect("valid audio regex") }
}

static FORMATS: LazyLock<Vec<Format>> = LazyLock::new(|| {
    vec![
        format("TrueHD", r"(?i)\btrue[ .-]?hd\b"),
        format("DTS:X", r"(?i)\bdts[ .:-]?x\b"),
        format("DTS-HD MA", r"(?i)\bdts[ .-]?hd[ .-]?ma\b|\bdts[ .-]?ma\b"),
        format("DTS-HD", r"(?i)\bdts[ .-]?hd\b"),
        format("DTS", r"(?i)\bdts\b"),
        format("DD+", r"(?i)\b(ddp|dd\+|e-?ac-?3)|\bdd[ .-]?plus\b"),
        format("DD", r"(?i)\b(dd|ac-?3)(?:[ .]?[257][ .]?[01])?\b"),
        format("FLAC", r"(?i)\bflac\b"),
        format("Opus", r"(?i)\bopus\b"),
        format("AAC", r"(?i)\baac\b"),
        format("MP3", r"(?i)\bmp3\b"),
    ]
});

static ATMOS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\batmos\b").expect("valid atmos regex"));
static CHANNELS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|[^\d.])([1-9])[ .]([01])(?:ch)?(?:[^\d.]|$)").expect("valid channels regex"));

pub fn audio(text: &str) -> Option<String> {
    let codec = FORMATS.iter().find(|format| format.pattern.is_match(text)).map(|format| format.name);
    let atmos = ATMOS.is_match(text);
    let channels = CHANNELS.captures(text).map(|found| format!("{}.{}", &found[1], &found[2]));
    let parts: Vec<String> = [codec.map(str::to_owned), channels, atmos.then(|| "Atmos".to_owned())].into_iter().flatten().collect();
    (!parts.is_empty()).then(|| parts.join(" "))
}
