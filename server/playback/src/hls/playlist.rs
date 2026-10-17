use std::fmt::Write;

use super::segments::Segment;
use crate::urls::tokenized;

pub fn vod_playlist(segments: &[Segment], token: &str) -> String {
    let target = segments.iter().map(|segment| segment.duration).fold(0.0, f64::max).ceil();
    let mut playlist = format!("#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:{target}\n#EXT-X-MEDIA-SEQUENCE:0\n");
    for (index, segment) in segments.iter().enumerate() {
        let _ = write!(playlist, "#EXTINF:{:.6},\n{}\n", segment.duration, tokenized(&format!("{index}.ts"), token));
    }
    playlist.push_str("#EXT-X-ENDLIST\n");
    playlist
}
