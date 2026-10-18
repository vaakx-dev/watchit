mod board;
mod fit;
mod pairing;
mod random;
mod ratings;
mod routes;
mod store;
mod types;

pub use routes::{next, ranked, result, skip, undo};
pub use store::TABLE;
pub use types::{DuelBoard, DuelPair, DuelRanking, DuelResult};
