mod routes;
mod store;
mod types;

pub use routes::{clear, forget, list, remember};
pub use store::TABLE;
pub use types::{NewSearch, RecentSearches};
