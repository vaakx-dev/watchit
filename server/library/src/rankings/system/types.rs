use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export_to = "library/")]
pub enum RankingSystem {
    #[default]
    Stars,
    Duels,
}

impl RankingSystem {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stars => "stars",
            Self::Duels => "duels",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        [Self::Stars, Self::Duels].into_iter().find(|system| system.as_str() == value)
    }
}

#[derive(Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "library/")]
pub struct RankingChoice {
    pub system: RankingSystem,
}
