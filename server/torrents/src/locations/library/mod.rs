mod import;
mod language;
mod link;
mod naming;
mod store;
pub mod subtitles;

use std::path::PathBuf;

pub use store::{create_table, load};

#[derive(Clone, Debug)]
pub struct LibraryLink {
    pub file_index: usize,
    pub path: PathBuf,
}
