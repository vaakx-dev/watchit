use std::io;
use std::path::{Path, PathBuf};

pub struct Placement {
    pub from: PathBuf,
    pub to: PathBuf,
}

fn with_extension(base: &Path, suffix: &str) -> PathBuf {
    let mut text = base.as_os_str().to_owned();
    text.push(suffix);
    PathBuf::from(text)
}

pub fn free_name(base: &Path, suffix: &str, labels: &[String]) -> PathBuf {
    let plain = with_extension(base, suffix);
    if !plain.exists() {
        return plain;
    }
    for label in labels {
        let labelled = with_extension(&with_extension(base, &format!(" - {label}")), suffix);
        if !labelled.exists() {
            return labelled;
        }
    }
    (2..)
        .map(|copy| with_extension(base, &format!(".{copy}{suffix}")))
        .find(|path| !path.exists())
        .expect("a free name")
}

pub fn place(file: &Placement) -> io::Result<()> {
    if let Some(parent) = file.to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if std::fs::hard_link(&file.from, &file.to).is_ok() {
        return Ok(());
    }
    std::fs::copy(&file.from, &file.to).map(|_| ())
}

pub fn unplace(path: &Path, roots: &[PathBuf]) {
    if std::fs::remove_file(path).is_err() {
        return;
    }
    let Some(root) = roots.iter().find(|root| path.starts_with(root)) else {
        return;
    };
    for folder in path
        .ancestors()
        .skip(1)
        .take_while(|folder| *folder != root.as_path() && folder.starts_with(root))
    {
        if std::fs::remove_dir(folder).is_err() {
            break;
        }
    }
}
