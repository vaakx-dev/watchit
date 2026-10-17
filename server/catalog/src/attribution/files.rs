use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use serde::de::DeserializeOwned;
use watchit_core::{AppError, AppResult};

const README: &str = "# Attribution archive

- titles/ID.json: current public metadata, source links, and image references. Episode IDs use percent-encoded colons in filenames.
- images/KEY.json: image source URLs, credits, licenses, retrieval times, and referring title IDs.
- manual/: documents and notes. Generated writes leave these files unchanged.

Title snapshots are replaced on update. Image records remain after artwork replacement or cache eviction. Null fields mean information was not supplied. Image files are stored separately in the image cache.

URL credentials, queries, and fragments are omitted. Personal library state and playback mappings are not exported.

Writes are atomic per file and serialized within one process. Run only one writer against this directory.
";

static TEMPORARY: AtomicU64 = AtomicU64::new(0);

pub(crate) fn prepare(folder: &Path) -> io::Result<()> {
    for name in ["titles", "images", "manual"] {
        std::fs::create_dir_all(folder.join(name))?;
    }
    for name in ["", "titles", "images"] {
        for entry in std::fs::read_dir(folder.join(name))? {
            let path = entry?.path();
            if path.extension().is_some_and(|extension| extension == "tmp") {
                std::fs::remove_file(path)?;
            }
        }
    }
    write_atomic(&folder.join("README.md"), README.as_bytes())
}

fn write_atomic(path: &Path, content: &[u8]) -> io::Result<()> {
    let suffix = TEMPORARY.fetch_add(1, Ordering::Relaxed);
    let temporary = path.with_file_name(format!(
        "{}.{}.{suffix}.tmp",
        path.file_name().and_then(|name| name.to_str()).unwrap_or("file"),
        std::process::id()
    ));
    let written = std::fs::write(&temporary, content).and_then(|()| std::fs::rename(&temporary, path));
    if written.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    written
}

pub(crate) fn read_json<T: DeserializeOwned>(path: &Path) -> AppResult<Option<T>> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(AppError::internal),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(AppError::internal(error)),
    }
}

pub(crate) fn write_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let mut text = serde_json::to_string_pretty(value).map_err(AppError::internal)?;
    text.push('\n');
    write_atomic(path, text.as_bytes()).map_err(AppError::internal)
}
