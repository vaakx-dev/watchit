mod admission;
mod episodes;
mod order;
mod slots;
mod store;

pub use episodes::wanted_files;
pub use order::{next_rank, number};
pub use slots::{Slot, assign_slots, used_by_drive};
pub use store::{create_table, load_ranks, save_rank};
