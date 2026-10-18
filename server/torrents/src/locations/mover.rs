use std::io;
use std::path::{Path, PathBuf};

use super::volume::same_volume;

pub struct Relocation {
    pub from: PathBuf,
    pub to: PathBuf,
}

enum Done {
    Renamed(Relocation),
    Copied(Relocation),
}

fn place(file: &Relocation) -> io::Result<Done> {
    if file.to.exists() {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            format!("{} already exists", file.to.display()),
        ));
    }
    let parent = file
        .to
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no folder"))?;
    std::fs::create_dir_all(parent)?;
    let copy = !same_volume(&file.from, parent);
    let relocation = Relocation {
        from: file.from.clone(),
        to: file.to.clone(),
    };
    if copy {
        std::fs::copy(&file.from, &file.to)?;
        Ok(Done::Copied(relocation))
    } else {
        std::fs::rename(&file.from, &file.to)?;
        Ok(Done::Renamed(relocation))
    }
}

fn undo(done: Vec<Done>) {
    for step in done.into_iter().rev() {
        let _ = match step {
            Done::Renamed(file) => std::fs::rename(&file.to, &file.from),
            Done::Copied(file) => std::fs::remove_file(&file.to),
        };
    }
}

pub fn move_files(files: &[Relocation]) -> io::Result<()> {
    let present: Vec<&Relocation> = files.iter().filter(|file| file.from.is_file()).collect();
    let mut done = Vec::new();
    for file in present {
        match place(file) {
            Ok(step) => done.push(step),
            Err(error) => {
                undo(done);
                return Err(error);
            }
        }
    }
    for step in &done {
        if let Done::Copied(file) = step {
            std::fs::remove_file(&file.from)?;
        }
    }
    Ok(())
}

pub fn remove_empty_parents(file: &Path, stop: &Path) {
    for folder in file.ancestors().skip(1).take_while(|folder| folder.starts_with(stop)) {
        if std::fs::remove_dir(folder).is_err() {
            break;
        }
    }
}
