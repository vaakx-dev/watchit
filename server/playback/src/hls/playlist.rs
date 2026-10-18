use std::fmt::Write;

use super::fragments::segment_name;
use super::segments::Segment;
use crate::urls::tokenized;

pub const INIT_NAME: &str = "init.mp4";

pub fn vod_playlist(segments: &[Segment], token: &str) -> String {
    let target = segments.iter().map(|segment| segment.duration).fold(0.0, f64::max).ceil();
    let mut playlist = format!(
        "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:{target}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-INDEPENDENT-SEGMENTS\n"
    );
    let _ = writeln!(playlist, "#EXT-X-MAP:URI=\"{}\"", tokenized(INIT_NAME, token));
    for (index, segment) in segments.iter().enumerate() {
        let _ = write!(playlist, "#EXTINF:{:.6},\n{}\n", segment.duration, tokenized(&segment_name(index), token));
    }
    playlist.push_str("#EXT-X-ENDLIST\n");
    playlist
}
