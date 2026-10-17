use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "library/")]
pub enum Status {
    Want,
    Watching,
    Paused,
    Watched,
    Dropped,
}

impl Status {
    pub const ALL: [Status; 5] = [Self::Want, Self::Watching, Self::Paused, Self::Watched, Self::Dropped];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Want => "want",
            Self::Watching => "watching",
            Self::Paused => "paused",
            Self::Watched => "watched",
            Self::Dropped => "dropped",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|status| status.as_str() == value)
    }

    pub fn parse_list(value: &str) -> AppResult<Vec<Self>> {
        value
            .split(',')
            .filter(|part| !part.is_empty())
            .map(|part| Self::parse(part).ok_or_else(|| AppError::bad_request("hide must list want, watching, paused, watched or dropped.")))
            .collect()
    }

    pub fn clears_progress(status: Option<Self>) -> bool {
        matches!(status, None | Some(Self::Want | Self::Watched))
    }
}

impl ToSql for Status {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        self.as_str().to_sql()
    }
}

impl FromSql for Status {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let text = value.as_str()?;
        Self::parse(text).ok_or_else(|| FromSqlError::Other(format!("unknown status {text}").into()))
    }
}
