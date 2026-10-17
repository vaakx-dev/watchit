use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use bytes::Bytes;
use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, Session};

use super::Handle;
use super::magnet::magnet;

#[derive(Clone, Debug)]
pub struct MetadataFile {
    pub index: usize,
    pub path: String,
    pub size_bytes: u64,
}

pub struct Metadata {
    pub name: String,
    pub files: Vec<MetadataFile>,
    torrent_bytes: Bytes,
    seen_peers: Vec<SocketAddr>,
}

pub struct AddRequest {
    pub output_folder: PathBuf,
    pub only_files: Vec<usize>,
    pub paused: bool,
    pub trackers: Vec<String>,
}

pub async fn resolve(session: &Arc<Session>, info_hash: &str, trackers: &[String]) -> anyhow::Result<Metadata> {
    let options = AddTorrentOptions { list_only: true, ..Default::default() };
    let response = session.add_torrent(AddTorrent::from_url(magnet(info_hash, trackers)), Some(options)).await?;
    let AddTorrentResponse::ListOnly(listed) = response else {
        anyhow::bail!("torrent metadata was not listed");
    };
    let files = listed
        .info
        .iter_file_details()
        .enumerate()
        .filter(|(_, details)| !details.attrs().padding)
        .map(|(index, details)| MetadataFile { index, path: details.filename.to_vec().join("/"), size_bytes: details.len })
        .collect();
    let name = listed.info.name().map(|name| name.into_owned()).unwrap_or_else(|| info_hash.to_owned());
    Ok(Metadata { name, files, torrent_bytes: listed.torrent_bytes, seen_peers: listed.seen_peers })
}

pub async fn add_resolved(session: &Arc<Session>, metadata: &Metadata, request: AddRequest) -> anyhow::Result<Handle> {
    let options = AddTorrentOptions {
        paused: request.paused,
        only_files: Some(request.only_files),
        overwrite: true,
        output_folder: Some(request.output_folder.to_str().context("download folder is not valid unicode")?.to_owned()),
        initial_peers: Some(metadata.seen_peers.clone()),
        trackers: Some(request.trackers),
        ..Default::default()
    };
    let response = session.add_torrent(AddTorrent::from_bytes(metadata.torrent_bytes.clone()), Some(options)).await?;
    response.into_handle().context("torrent was not added")
}

pub fn files_of(handle: &Handle) -> anyhow::Result<Vec<MetadataFile>> {
    handle.with_metadata(|metadata| {
        metadata
            .file_infos
            .iter()
            .enumerate()
            .filter(|(_, info)| !info.attrs.padding)
            .map(|(index, info)| MetadataFile {
                index,
                path: info.relative_filename.components().map(|part| part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/"),
                size_bytes: info.len,
            })
            .collect()
    })
}
