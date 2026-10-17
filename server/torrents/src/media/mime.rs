use crate::release::files::extension;

pub fn content_type(name: &str) -> &'static str {
    match extension(name).as_deref() {
        Some("mkv") => "video/x-matroska",
        Some("mp4") => "video/mp4",
        Some("m4v") => "video/x-m4v",
        Some("webm") => "video/webm",
        Some("avi") => "video/x-msvideo",
        Some("mov") => "video/quicktime",
        Some("wmv") => "video/x-ms-wmv",
        Some("flv") => "video/x-flv",
        Some("ts" | "m2ts") => "video/mp2t",
        Some("mpg" | "mpeg") => "video/mpeg",
        Some("ogv") => "video/ogg",
        Some("3gp") => "video/3gpp",
        Some("srt") => "application/x-subrip",
        Some("vtt") => "text/vtt",
        _ => "application/octet-stream",
    }
}
