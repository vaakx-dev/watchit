mod cli;
mod probe;
mod serve;
mod share;
mod types;

pub use probe::probe;
pub use share::set_sharing;
pub use types::{Sharing, SharingChange, TailscaleState, TailscaleStatus};
