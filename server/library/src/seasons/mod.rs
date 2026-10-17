mod routes;
mod store;
mod types;

pub use routes::update;
pub use store::{TABLE, all};
pub use types::{SeasonPatch, SeasonWatched};
