pub mod routes;

use serde::Serialize;
use ts_rs::TS;

use crate::release::video;
use crate::transfers::Transfers;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "torrents/")]
pub struct LocalFile {
    pub info_hash: String,
    pub file_index: usize,
    pub name: String,
    pub size_bytes: u64,
    pub progress: f64,
    pub resolution: Option<String>,
    pub hdr: Vec<String>,
}

pub fn local_files(transfers: &Transfers, title_id: &str) -> Vec<LocalFile> {
    let entries = transfers.entries();
    let mut found: Vec<(i64, LocalFile)> = entries
        .values()
        .flat_map(|entry| {
            let progress = entry.progress();
            entry
                .files
                .iter()
                .zip(progress.per_file)
                .filter(|(file, _)| file.title_id.as_deref() == Some(title_id))
                .map(|(file, (_, have))| {
                    let text = format!("{} {}", entry.record.name, file.name);
                    let local = LocalFile {
                        info_hash: entry.record.info_hash.clone(),
                        file_index: file.index,
                        name: file.name.clone(),
                        size_bytes: file.size_bytes,
                        progress: if file.size_bytes == 0 {
                            0.0
                        } else {
                            have as f64 / file.size_bytes as f64
                        },
                        resolution: video::resolution(&text).map(|resolution| resolution.label().to_owned()),
                        hdr: video::hdr(&text).into_iter().map(|hdr| hdr.label().to_owned()).collect(),
                    };
                    (entry.record.added_at, local)
                })
                .collect::<Vec<_>>()
        })
        .collect();
    found.sort_by(|a, b| b.1.progress.total_cmp(&a.1.progress).then(b.0.cmp(&a.0)));
    found.into_iter().map(|(_, file)| file).collect()
}
