use std::fmt::Write;

use super::segments::Segment;
use crate::urls::media_url;

pub fn vod_playlist(segments: &[Segment], token: Option<&str>) -> String {
    let target = segments.iter().map(|segment| segment.duration).fold(0.0, f64::max).ceil();
    let mut playlist = format!("#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:{target}\n#EXT-X-MEDIA-SEQUENCE:0\n");
    for (index, segment) in segments.iter().enumerate() {
        let name = format!("{index}.ts");
        let uri = token.map_or_else(|| name.clone(), |token| media_url(&name, token));
        let _ = write!(playlist, "#EXTINF:{:.6},\n{uri}\n", segment.duration);
    }
    playlist.push_str("#EXT-X-ENDLIST\n");
    playlist
}
