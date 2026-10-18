use std::io;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use crate::Paths;

const SECRET_FILE: &str = "stream-token.key";
const LIFETIME: Duration = Duration::from_secs(12 * 60 * 60);

type Signer = Hmac<Sha256>;

#[derive(Clone)]
pub struct StreamTokens {
    secret: Arc<[u8; 32]>,
}

struct Claims<'a> {
    profile: i64,
    expires: u64,
    prefix: &'a str,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn covers(prefix: &str, path: &str) -> bool {
    let Some(rest) = path.strip_prefix(prefix) else { return false };
    rest.is_empty() || prefix.ends_with('/') || rest.starts_with('/')
}

impl<'a> Claims<'a> {
    fn encode(&self) -> String {
        format!("{}.{}.{}", self.profile, self.expires, self.prefix)
    }

    fn decode(text: &'a str) -> Option<Self> {
        let mut parts = text.splitn(3, '.');
        let profile = parts.next()?.parse().ok()?;
        let expires = parts.next()?.parse().ok()?;
        Some(Self {
            profile,
            expires,
            prefix: parts.next()?,
        })
    }
}

impl StreamTokens {
    pub fn load(paths: &Paths) -> io::Result<Self> {
        let file = paths.root().join(SECRET_FILE);
        let secret = match std::fs::read(&file).ok().and_then(|bytes| <[u8; 32]>::try_from(bytes).ok()) {
            Some(secret) => secret,
            None => {
                let secret = rand::random::<[u8; 32]>();
                std::fs::write(&file, secret)?;
                secret
            }
        };
        Ok(Self { secret: Arc::new(secret) })
    }

    fn signer(&self, claims: &str) -> Signer {
        let mut signer = Signer::new_from_slice(self.secret.as_slice()).expect("HMAC accepts any key length");
        signer.update(claims.as_bytes());
        signer
    }

    pub fn mint(&self, profile: i64, prefix: &str) -> String {
        let claims = Claims {
            profile,
            expires: now() + LIFETIME.as_secs(),
            prefix,
        }
        .encode();
        let signature = self.signer(&claims).finalize().into_bytes();
        format!("{}.{}", URL_SAFE_NO_PAD.encode(&claims), URL_SAFE_NO_PAD.encode(signature))
    }

    pub fn url(&self, profile: i64, path: &str) -> String {
        format!("{path}?token={}", self.mint(profile, path))
    }

    pub fn verify(&self, token: &str, path: &str) -> Option<i64> {
        let (claims, signature) = token.split_once('.')?;
        let claims = String::from_utf8(URL_SAFE_NO_PAD.decode(claims).ok()?).ok()?;
        let signature = URL_SAFE_NO_PAD.decode(signature).ok()?;
        self.signer(&claims).verify_slice(&signature).ok()?;
        let claims = Claims::decode(&claims)?;
        (claims.expires > now() && covers(claims.prefix, path)).then_some(claims.profile)
    }
}
