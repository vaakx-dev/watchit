use std::collections::HashSet;
use std::sync::Mutex;

use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};
use serde::{Deserialize, Serialize};

use crate::cinemeta::client::Client;
use crate::cinemeta::error::SourceError;
use crate::cinemeta::mapping::{BASE_URL, media_kind, meta_url, valid};
use crate::cinemeta::meta::{CatalogResponse, Manifest, Meta, MetaResponse};
use crate::clock::{DAY_MS, now_ms};
use crate::genres::canonical_ids;
use crate::ids::genre_id;
use crate::model::{CatalogKind, MediaKind};

const SOURCE_PAGE_SIZE: u32 = 50;
const COMPONENT: &AsciiSet = &NON_ALPHANUMERIC.remove(b'-').remove(b'_').remove(b'.').remove(b'!').remove(b'~').remove(b'*').remove(b'\'').remove(b'(').remove(b')');

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct SourceQuery {
    pub kind: CatalogKind,
    pub query: String,
    pub genre: String,
}

pub(crate) struct SourcePage {
    pub metas: Vec<Meta>,
    pub has_next: bool,
}

pub(crate) struct Source {
    client: Client,
    manifest: Mutex<Option<(i64, Manifest)>>,
}

fn encode(value: &str) -> String {
    utf8_percent_encode(value, COMPONENT).to_string()
}

impl Source {
    pub fn new() -> Self {
        Self { client: Client::new(), manifest: Mutex::new(None) }
    }

    async fn manifest(&self) -> Result<Manifest, SourceError> {
        if let Some((fetched_at, manifest)) = self.manifest.lock().unwrap().as_ref()
            && now_ms() - fetched_at < DAY_MS
        {
            return Ok(manifest.clone());
        }
        let manifest: Manifest = self.client.get(&format!("{BASE_URL}/manifest.json")).await?;
        *self.manifest.lock().unwrap() = Some((now_ms(), manifest.clone()));
        Ok(manifest)
    }

    async fn genre_label(&self, kind: MediaKind, wanted: &str) -> Result<Option<String>, SourceError> {
        let wanted = canonical_ids(wanted);
        let manifest = self.manifest().await?;
        let catalog = manifest.catalogs.iter().find(|catalog| catalog.kind == kind.as_str() && catalog.id == "top");
        Ok(catalog.and_then(|catalog| {
            catalog.genres.iter().find(|label| canonical_ids(&genre_id(label)).iter().any(|id| wanted.contains(id))).cloned()
        }))
    }

    pub async fn catalog(&self, query: &SourceQuery, page: u32, previous: &HashSet<String>) -> Result<SourcePage, SourceError> {
        let kinds = match query.kind {
            CatalogKind::Movie => vec![MediaKind::Movie],
            CatalogKind::Series => vec![MediaKind::Series],
            CatalogKind::All | CatalogKind::Anime => vec![MediaKind::Movie, MediaKind::Series],
        };
        let mut metas: Vec<Meta> = Vec::new();
        let mut has_next = false;
        for kind in kinds {
            let mut extras = Vec::new();
            if !query.genre.is_empty() || query.kind == CatalogKind::Anime {
                let wanted = if query.kind == CatalogKind::Anime { "animation" } else { query.genre.as_str() };
                let Some(label) = self.genre_label(kind, wanted).await? else { continue };
                extras.push(format!("genre={}", encode(&label)));
            }
            if !query.query.is_empty() {
                if page > 1 {
                    continue;
                }
                extras.push(format!("search={}", encode(&query.query)));
            }
            extras.push(format!("skip={}", (page - 1) * SOURCE_PAGE_SIZE));
            let url = format!("{BASE_URL}/catalog/{}/top/{}.json", kind.as_str(), extras.join("&"));
            let response: CatalogResponse = self.client.get(&url).await?;
            let repeated = page > 1 && !response.metas.is_empty() && response.metas.iter().all(|meta| previous.contains(meta.id()));
            if query.query.is_empty() && !response.metas.is_empty() && !repeated {
                has_next = true;
            }
            for meta in response.metas {
                match metas.iter_mut().find(|known| known.id() == meta.id()) {
                    Some(known) => *known = meta,
                    None => metas.push(meta),
                }
            }
        }
        Ok(SourcePage { metas, has_next })
    }

    pub async fn title(&self, id: &str, kind: Option<MediaKind>) -> Result<Meta, SourceError> {
        let mut parts = id.split(':');
        let parent = parts.next().unwrap_or_default();
        let kinds = match (parts.next(), kind) {
            (Some(_), _) => vec![MediaKind::Series],
            (None, Some(kind)) if kind != MediaKind::Episode => vec![kind],
            _ => vec![MediaKind::Movie, MediaKind::Series],
        };
        for candidate in kinds {
            let response: MetaResponse = match self.client.get(&meta_url(candidate, parent)).await {
                Ok(response) => response,
                Err(error) if error.status == 404 => continue,
                Err(error) => return Err(error),
            };
            let Some(meta) = response.meta else { continue };
            if meta.id() == parent && media_kind(&meta) == Some(candidate) && valid(&meta) {
                return Ok(meta);
            }
        }
        Err(SourceError::missing())
    }
}
