use std::sync::LazyLock;

use regex::Regex;

const VIDEO_EXTENSIONS: [&str; 17] = [
    "mkv", "mp4", "m4v", "avi", "mov", "wmv", "webm", "ts", "m2ts", "mpg", "mpeg", "flv", "ogv", "3gp", "vob", "divx", "rmvb",
];

static SAMPLE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)(?:^|[^a-z])sample(?:[^a-z]|$)").expect("valid sample regex"));
static EXTRAS_FOLDER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(extras?|featurettes?|bonus|behind[ ._]the[ ._]scenes|deleted[ ._]scenes|interviews|trailers?)$")
        .expect("valid extras regex")
});

pub fn extension(name: &str) -> Option<String> {
    name.rsplit_once('.').map(|(_, extension)| extension.to_ascii_lowercase())
}

pub fn is_video(name: &str) -> bool {
    extension(name).is_some_and(|extension| VIDEO_EXTENSIONS.contains(&extension.as_str()))
}

pub fn is_extra(path: &str) -> bool {
    let mut parts = path.split(['/', '\\']).rev();
    let file = parts.next().unwrap_or_default();
    SAMPLE.is_match(file) || parts.any(|folder| EXTRAS_FOLDER.is_match(folder) || SAMPLE.is_match(folder))
}

pub fn is_feature(path: &str) -> bool {
    is_video(path) && !is_extra(path)
}
