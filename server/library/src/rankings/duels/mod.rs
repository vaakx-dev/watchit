mod board;
mod elo;
mod pairing;
mod random;
mod routes;
mod store;
mod types;

pub use routes::{next, ranked, result, skip, undo};
pub use store::TABLE;
pub use types::{DuelBoard, DuelPair, DuelRanking, DuelResult};
