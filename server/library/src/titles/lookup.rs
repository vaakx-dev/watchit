use watchit_catalog::MediaKind;

use crate::ids::series_of;

#[derive(Clone, Debug)]
pub struct TitleRef {
    pub kind: MediaKind,
    pub series_id: Option<String>,
}

impl TitleRef {
    pub fn new(id: &str, kind: MediaKind) -> Self {
        let series_id = (kind == MediaKind::Episode).then(|| series_of(id).to_owned());
        Self { kind, series_id }
    }
}
