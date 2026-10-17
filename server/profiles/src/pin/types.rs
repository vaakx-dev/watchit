use serde::{Deserialize, Deserializer};
use ts_rs::TS;

const PIN_LENGTH: usize = 4;

#[derive(Deserialize)]
#[serde(try_from = "String")]
pub struct Pin(String);

impl Pin {
    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

impl TryFrom<String> for Pin {
    type Error = String;

    fn try_from(pin: String) -> Result<Self, String> {
        if pin.len() == PIN_LENGTH && pin.bytes().all(|byte| byte.is_ascii_digit()) {
            Ok(Self(pin))
        } else {
            Err(format!("A PIN is exactly {PIN_LENGTH} digits."))
        }
    }
}

fn nullable<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Pin>, D::Error> {
    Option::deserialize(deserializer)
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "profiles/")]
pub struct PinChange {
    #[serde(deserialize_with = "nullable")]
    #[ts(type = "string | null")]
    pub pin: Option<Pin>,
    #[serde(default)]
    #[ts(optional, type = "string")]
    pub current_pin: Option<Pin>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SignIn {
    #[serde(default)]
    pub pin: Option<Pin>,
}
