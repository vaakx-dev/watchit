mod cache;
mod clock;
mod download;
mod encode;
mod failure;
mod key;
mod prefetch;
mod records;
mod routes;
mod service;
mod settings;
mod slots;
mod source;

pub use cache::Fetched;
pub use key::ImageKey;
pub use routes::{router, status_router};
pub use service::{Artwork, ArtworkStatus, ImageSet, ImageUsage};
pub use settings::{ImageSettings, ImageSettingsPatch};
pub use source::{approved_url, backdrop_url};

pub fn export_types(config: &ts_rs::Config) -> Result<(), ts_rs::ExportError> {
    use ts_rs::TS;
    ArtworkStatus::export_all(config)?;
    ImageUsage::export_all(config)?;
    ImageSettings::export_all(config)
}
