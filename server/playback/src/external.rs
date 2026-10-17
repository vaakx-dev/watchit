use crate::source::{SourceFile, SourceInput, SourceRef};

pub const FIRST_INDEX: u32 = 10_000;

const VIDEO_EXTENSIONS: [&str; 10] = ["mkv", "mp4", "m4v", "avi", "mov", "wmv", "webm", "ts", "m2ts", "mpg"];

const LANGUAGES: [(&[&str], &str); 20] = [
    (&["en", "eng", "english"], "eng"),
    (&["es", "spa", "spanish", "espanol"], "spa"),
    (&["fr", "fre", "fra", "french"], "fre"),
    (&["de", "ger", "deu", "german"], "ger"),
    (&["it", "ita", "italian"], "ita"),
    (&["pt", "por", "portuguese", "brazilian"], "por"),
    (&["ru", "rus", "russian"], "rus"),
    (&["ja", "jpn", "japanese"], "jpn"),
    (&["ko", "kor", "korean"], "kor"),
    (&["zh", "chi", "zho", "chinese"], "chi"),
    (&["ar", "ara", "arabic"], "ara"),
    (&["nl", "dut", "nld", "dutch"], "dut"),
    (&["pl", "pol", "polish"], "pol"),
    (&["sv", "swe", "swedish"], "swe"),
    (&["tr", "tur", "turkish"], "tur"),
    (&["hi", "hin", "hindi"], "hin"),
    (&["da", "dan", "danish"], "dan"),
    (&["fi", "fin", "finnish"], "fin"),
    (&["cs", "cze", "ces", "czech"], "cze"),
    (&["el", "gre", "ell", "greek"], "gre"),
];

#[derive(Clone, Debug)]
pub struct ExternalSubtitle {
    pub index: u32,
    pub source: SourceRef,
    pub input: SourceInput,
    pub language: Option<String>,
    pub title: String,
    pub codec: &'static str,
}

#[derive(Clone, Debug)]
pub struct Candidate {
    pub file_index: u32,
    pub language: Option<String>,
    pub title: String,
    pub codec: &'static str,
}

fn extension(path: &str) -> String {
    path.rsplit_once('.').map(|(_, extension)| extension.to_ascii_lowercase()).unwrap_or_default()
}

fn codec(path: &str) -> Option<&'static str> {
    match extension(path).as_str() {
        "srt" => Some("subrip"),
        "ass" => Some("ass"),
        "ssa" => Some("ssa"),
        "vtt" => Some("webvtt"),
        _ => None,
    }
}

fn split(path: &str) -> (String, String) {
    let lower = path.to_ascii_lowercase();
    let (folder, name) = lower.rsplit_once('/').unwrap_or(("", &lower));
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    (folder.to_owned(), stem.to_owned())
}

fn language_of(stem: &str, video_stem: &str) -> Option<String> {
    let rest = stem.strip_prefix(video_stem).unwrap_or(stem);
    rest.split(|c: char| !c.is_alphanumeric())
        .find_map(|token| LANGUAGES.iter().find(|(names, _)| names.contains(&token)).map(|(_, code)| (*code).to_owned()))
}

pub fn matching(files: &[SourceFile], video: u32) -> Vec<Candidate> {
    let Some(video_file) = files.iter().find(|file| file.index == video) else { return Vec::new() };
    let (video_folder, video_stem) = split(&video_file.path);
    let sole_video = files.iter().filter(|file| VIDEO_EXTENSIONS.contains(&extension(&file.path).as_str())).count() <= 1;
    let mut found: Vec<Candidate> = files
        .iter()
        .filter_map(|file| {
            let codec = codec(&file.path)?;
            let (folder, stem) = split(&file.path);
            let near = folder == video_folder || folder.starts_with(&format!("{video_folder}/")) || video_folder.is_empty();
            let named = stem.starts_with(&video_stem) || folder.rsplit('/').next() == Some(video_stem.as_str());
            let belongs = if sole_video { true } else { near && named };
            belongs.then(|| Candidate {
                file_index: file.index,
                language: language_of(&stem, &video_stem),
                title: file.path.rsplit('/').next().unwrap_or(&file.path).to_owned(),
                codec,
            })
        })
        .collect();
    found.sort_by(|a, b| a.title.cmp(&b.title));
    found
}
