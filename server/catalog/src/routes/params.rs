use watchit_core::{AppError, AppResult};

use crate::ids::{is_genre_id, is_title_id};
use crate::model::{CatalogKind, CatalogSort};
use crate::personal::HIDE_STATUSES;

pub(crate) struct Params(pub Vec<(String, String)>);

fn digits(value: &str, allow_zero: bool) -> bool {
    let valid = !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit());
    valid && (value == "0" && allow_zero || !value.starts_with('0'))
}

impl Params {
    pub fn get(&self, name: &str) -> Option<&str> {
        self.0.iter().find(|(key, _)| key == name).map(|(_, value)| value.as_str())
    }

    pub fn page(&self) -> AppResult<u32> {
        let value = self.get("page").unwrap_or("1");
        let page = value.parse::<u32>().ok().filter(|page| digits(value, false) && *page <= 100_000);
        page.ok_or_else(|| AppError::bad_request("Invalid page number."))
    }

    pub fn optional_page(&self) -> AppResult<Option<u32>> {
        self.get("page").map(|_| self.page()).transpose()
    }

    pub fn season(&self) -> AppResult<Option<i64>> {
        let Some(value) = self.get("season") else { return Ok(None) };
        let season = value.parse::<i64>().ok().filter(|season| digits(value, true) && *season <= 99_999);
        season.map(Some).ok_or_else(|| AppError::bad_request("Invalid season number."))
    }

    pub fn kind(&self) -> AppResult<CatalogKind> {
        CatalogKind::parse(self.get("kind").unwrap_or("all")).ok_or_else(|| AppError::bad_request("Invalid catalog type."))
    }

    pub fn sort(&self) -> AppResult<CatalogSort> {
        CatalogSort::parse(self.get("sort").unwrap_or("newest")).ok_or_else(|| AppError::bad_request("Invalid catalog sort."))
    }

    pub fn query(&self) -> AppResult<String> {
        let query = self.get("query").unwrap_or("").trim();
        if query.encode_utf16().count() > 200 {
            return Err(AppError::bad_request("Search is limited to 200 characters."));
        }
        Ok(query.to_owned())
    }

    pub fn genre(&self) -> AppResult<String> {
        let genre = self.get("genre").unwrap_or("");
        if !genre.is_empty() && !is_genre_id(genre) {
            return Err(AppError::bad_request("Invalid genre identifier."));
        }
        Ok(genre.to_owned())
    }

    pub fn hide(&self) -> AppResult<Vec<String>> {
        let statuses: Vec<String> = self
            .get("hide")
            .unwrap_or("")
            .split(',')
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect();
        if statuses.iter().any(|status| !HIDE_STATUSES.contains(&status.as_str())) {
            return Err(AppError::bad_request("hide must list want, watching, paused, watched or dropped."));
        }
        Ok(statuses)
    }
}

pub(crate) fn title_id(id: &str) -> AppResult<String> {
    if is_title_id(id) {
        Ok(id.to_owned())
    } else {
        Err(AppError::bad_request("Invalid title identifier."))
    }
}
