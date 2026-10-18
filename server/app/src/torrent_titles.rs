use async_trait::async_trait;
use watchit_catalog::Catalog;
use watchit_core::Db;
use watchit_torrents::{TitleName, Titles};

pub struct CatalogTitles {
    catalog: Catalog,
    db: Db,
}

impl CatalogTitles {
    pub fn new(catalog: Catalog, db: Db) -> Self {
        Self { catalog, db }
    }
}

fn episode_number(id: &str) -> Option<u32> {
    id.rsplit(':').next()?.parse().ok()
}

#[async_trait]
impl Titles for CatalogTitles {
    async fn runtime_minutes(&self, title_id: &str) -> Option<u32> {
        let catalog = self.catalog.clone();
        let id = title_id.to_owned();
        self.db.run(move |conn| catalog.runtime_minutes(conn, &id)).await.ok().flatten()
    }

    async fn season_episodes(&self, series_id: &str, season: u32) -> Vec<u32> {
        let catalog = self.catalog.clone();
        let series = series_id.to_owned();
        let ids = self.db.run(move |conn| catalog.season_episodes(conn, &series, i64::from(season))).await;
        ids.unwrap_or_default().iter().filter_map(|id| episode_number(id)).collect()
    }

    async fn name(&self, title_id: &str) -> Option<TitleName> {
        let catalog = self.catalog.clone();
        let ids = vec![title_id.to_owned()];
        let (entries, _) = self.db.run(move |conn| catalog.entries(conn, &ids)).await.ok()?;
        entries.into_iter().next().map(|entry| TitleName {
            title: entry.title,
            year: entry.year,
        })
    }
}
