use std::io;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct Paths {
    root: PathBuf,
}

impl Paths {
    pub fn new(root: PathBuf) -> io::Result<Self> {
        std::fs::create_dir_all(&root)?;
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn database(&self) -> PathBuf {
        self.root.join("watchit.sqlite")
    }

    pub fn folder(&self, name: &str) -> io::Result<PathBuf> {
        let folder = self.root.join(name);
        std::fs::create_dir_all(&folder)?;
        Ok(folder)
    }
}
