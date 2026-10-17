use std::sync::Arc;

use librqbit::api::TorrentIdOrHash;
use librqbit::{Api, Session};

use crate::engine::Handle;

pub struct Geometry {
    pub file_offset: u64,
    pub file_len: u64,
    pub piece_len: u64,
}

pub fn geometry(handle: &Handle, file: usize) -> Option<Geometry> {
    handle
        .with_metadata(|metadata| {
            let info = metadata.file_infos.get(file)?;
            Some(Geometry {
                file_offset: info.offset_in_torrent,
                file_len: info.len,
                piece_len: u64::from(metadata.info.lengths().default_piece_length()),
            })
        })
        .ok()
        .flatten()
}

pub fn contiguous_from(session: &Arc<Session>, handle: &Handle, geometry: &Geometry, position: u64) -> u64 {
    let Ok((haves, total)) = Api::new(Arc::clone(session), None).api_dump_haves(TorrentIdOrHash::Hash(handle.info_hash())) else {
        return 0;
    };
    let absolute = geometry.file_offset + position.min(geometry.file_len);
    let first = (absolute / geometry.piece_len) as usize;
    let total = total as usize;
    if first >= total || !haves[first] {
        return 0;
    }
    let missing = haves[first..].first_zero().map_or(total, |gap| first + gap);
    let end = (missing as u64 * geometry.piece_len).min(geometry.file_offset + geometry.file_len);
    end.saturating_sub(absolute)
}
