use std::collections::HashMap;

use super::bytes::ByteReader;
use super::ebml::{Element, child_value, children, element_at, unsigned};

const SEGMENT: u64 = 0x1853_8067;
const SEEK_HEAD: u64 = 0x114d_9b74;
const SEEK: u64 = 0x4dbb;
const SEEK_ID: u64 = 0x53ab;
const SEEK_POSITION: u64 = 0x53ac;
const INFO: u64 = 0x1549_a966;
const TIMESTAMP_SCALE: u64 = 0x2a_d7b1;
const TRACKS: u64 = 0x1654_ae6b;
const TRACK_ENTRY: u64 = 0xae;
const TRACK_NUMBER: u64 = 0xd7;
const TRACK_TYPE: u64 = 0x83;
const VIDEO_TRACK: u64 = 1;
const CUES: u64 = 0x1c53_bb6b;
const CUE_POINT: u64 = 0xbb;
const CUE_TIME: u64 = 0xb3;
const CUE_TRACK_POSITIONS: u64 = 0xb7;
const CUE_TRACK: u64 = 0xf7;
const HEAD_BYTES: u64 = 64 * 1024;
const HEADER_BYTES: u64 = 12;
const DEFAULT_TIMESTAMP_SCALE: u64 = 1_000_000;

pub async fn keyframes(reader: &ByteReader) -> Result<Vec<f64>, String> {
    let positions = seek_positions(&reader.read(0, HEAD_BYTES).await?);
    let at = |id: u64| positions.get(&id).copied().ok_or_else(|| format!("No seek entry for element {id:x}"));
    let (tracks, tracks_root) = read_element(reader, at(TRACKS)?).await?;
    let track = video_track(&tracks, tracks_root).ok_or("No video track")?;
    let scale = match positions.get(&INFO) {
        Some(position) => {
            let (info, root) = read_element(reader, *position).await?;
            child_value(&info, root, TIMESTAMP_SCALE).unwrap_or(DEFAULT_TIMESTAMP_SCALE)
        }
        None => DEFAULT_TIMESTAMP_SCALE,
    };
    let (cues, cues_root) = read_element(reader, at(CUES)?).await?;
    let mut times: Vec<u64> = cue_times(&cues, cues_root, track);
    times.sort_unstable();
    times.dedup();
    Ok(times.into_iter().map(|time| (time * scale) as f64 / 1e9).collect())
}

async fn read_element(reader: &ByteReader, offset: u64) -> Result<(Vec<u8>, Element), String> {
    let header = reader.read(offset, HEADER_BYTES).await?;
    let element = element_at(&header, 0).ok_or("Invalid Matroska element")?;
    let bytes = reader.read(offset + element.start as u64, (element.end - element.start) as u64).await?;
    let root = Element { id: element.id, start: 0, end: bytes.len() };
    Ok((bytes, root))
}

fn seek_positions(head: &[u8]) -> HashMap<u64, u64> {
    let mut positions = HashMap::new();
    let Some(segment) = element_at(head, 0).and_then(|header| element_at(head, header.end)).filter(|segment| segment.id == SEGMENT) else {
        return positions;
    };
    for seek_head in children(head, segment).into_iter().filter(|element| element.id == SEEK_HEAD) {
        for seek in children(head, seek_head).into_iter().filter(|element| element.id == SEEK) {
            if let (Some(id), Some(position)) = (child_value(head, seek, SEEK_ID), child_value(head, seek, SEEK_POSITION)) {
                positions.insert(id, segment.start as u64 + position);
            }
        }
    }
    positions
}

fn video_track(bytes: &[u8], tracks: Element) -> Option<u64> {
    children(bytes, tracks)
        .into_iter()
        .filter(|element| element.id == TRACK_ENTRY)
        .find(|entry| child_value(bytes, *entry, TRACK_TYPE) == Some(VIDEO_TRACK))
        .and_then(|entry| child_value(bytes, entry, TRACK_NUMBER))
}

fn cue_times(bytes: &[u8], cues: Element, track: u64) -> Vec<u64> {
    children(bytes, cues)
        .into_iter()
        .filter(|element| element.id == CUE_POINT)
        .filter_map(|point| {
            let parts = children(bytes, point);
            let time = parts.iter().find(|element| element.id == CUE_TIME)?;
            let on_track = parts.iter().any(|element| element.id == CUE_TRACK_POSITIONS && child_value(bytes, *element, CUE_TRACK) == Some(track));
            on_track.then(|| unsigned(bytes, *time))
        })
        .collect()
}
