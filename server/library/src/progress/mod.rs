mod routes;
mod rules;
mod series;
mod store;

pub use routes::{ProgressSaved, Reading, clear, save};
pub use series::series_progress;
pub use store::{TABLE, forget, get};
