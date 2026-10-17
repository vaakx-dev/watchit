use async_trait::async_trait;

#[async_trait]
pub trait Titles: Send + Sync {
    async fn runtime_minutes(&self, title_id: &str) -> Option<u32>;

    async fn season_episodes(&self, series_id: &str, season: u32) -> Vec<u32>;
}

pub struct NoTitles;

#[async_trait]
impl Titles for NoTitles {
    async fn runtime_minutes(&self, _title_id: &str) -> Option<u32> {
        None
    }

    async fn season_episodes(&self, _series_id: &str, _season: u32) -> Vec<u32> {
        Vec::new()
    }
}
