use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(transparent)]
pub(crate) struct Fields(Map<String, Value>);

impl Fields {
    pub fn has(&self, key: &str) -> bool {
        self.0.contains_key(key)
    }

    pub fn value(&self, key: &str) -> Option<&Value> {
        self.0.get(key).filter(|value| !value.is_null())
    }

    pub fn text(&self, key: &str) -> Option<&str> {
        self.value(key).and_then(Value::as_str)
    }

    pub fn first_text(&self, keys: &[&str]) -> Option<String> {
        keys.iter().find_map(|key| self.value(key)).map(|value| match value {
            Value::String(text) => text.clone(),
            other => other.to_string(),
        })
    }

    pub fn number(&self, key: &str) -> Option<f64> {
        self.value(key).and_then(Value::as_f64)
    }

    pub fn strings(&self, key: &str) -> Option<Vec<String>> {
        self.value(key).and_then(Value::as_array).map(|values| values.iter().filter_map(Value::as_str).map(str::to_owned).collect())
    }

    pub fn coordinate(&self, key: &str) -> Option<Option<i64>> {
        let value = self.value(key)?;
        let number = value.as_f64().filter(|number| number.fract() == 0.0 && (0.0..=99_999.0).contains(number));
        Some(number.map(|number| number as i64))
    }
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(transparent)]
pub(crate) struct Meta {
    pub fields: Fields,
}

impl Meta {
    pub fn id(&self) -> &str {
        self.fields.text("id").unwrap_or("")
    }

    pub fn kind(&self) -> &str {
        self.fields.text("type").unwrap_or("")
    }

    pub fn videos(&self) -> Vec<Fields> {
        self.fields
            .value("videos")
            .and_then(Value::as_array)
            .map(|videos| videos.iter().filter_map(|video| serde_json::from_value(video.clone()).ok()).collect())
            .unwrap_or_default()
    }

    pub fn genre_labels(&self) -> Option<Vec<String>> {
        if !self.fields.has("genres") && !self.fields.has("genre") {
            return None;
        }
        let labels = self.fields.strings("genres").or_else(|| self.fields.strings("genre")).unwrap_or_default();
        let mut unique: Vec<String> = Vec::with_capacity(labels.len());
        for label in labels {
            if !unique.contains(&label) {
                unique.push(label);
            }
        }
        Some(unique)
    }

    pub fn primary_country(&self) -> Option<String> {
        let first = match self.fields.value("country") {
            Some(Value::Array(values)) => values.iter().find_map(Value::as_str),
            Some(Value::String(text)) => text.split(',').next(),
            _ => None,
        };
        first.map(|country| country.trim().to_lowercase())
    }
}

#[derive(Debug, Default, Deserialize)]
pub(crate) struct CatalogResponse {
    #[serde(default)]
    pub metas: Vec<Meta>,
}

#[derive(Debug, Default, Deserialize)]
pub(crate) struct MetaResponse {
    #[serde(default)]
    pub meta: Option<Meta>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct Manifest {
    #[serde(default)]
    pub catalogs: Vec<ManifestCatalog>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ManifestCatalog {
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    #[serde(default)]
    pub genres: Vec<String>,
}
