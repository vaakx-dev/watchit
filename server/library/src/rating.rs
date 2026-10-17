use rusqlite::types::{FromSql, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, TS)]
#[ts(type = "0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5", export_to = "library/")]
pub struct Rating(u8);

impl Rating {
    pub fn from_stars(stars: f64) -> Option<Self> {
        let halves = stars * 2.0;
        (halves.fract() == 0.0 && (1.0..=10.0).contains(&halves)).then_some(Self(halves as u8))
    }

    pub fn stars(self) -> f64 {
        f64::from(self.0) / 2.0
    }
}

impl Serialize for Rating {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_f64(self.stars())
    }
}

impl<'de> Deserialize<'de> for Rating {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let stars = f64::deserialize(deserializer)?;
        Self::from_stars(stars).ok_or_else(|| serde::de::Error::custom("Rating must be 0.5 to 5 in half-star steps, or null to clear it."))
    }
}

impl ToSql for Rating {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        Ok(ToSqlOutput::from(self.stars()))
    }
}

impl FromSql for Rating {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let stars = f64::column_result(value)?;
        Self::from_stars(stars).ok_or(rusqlite::types::FromSqlError::OutOfRange(stars as i64))
    }
}
