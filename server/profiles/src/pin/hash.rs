use scrypt::Params;
use subtle::ConstantTimeEq;

use super::types::Pin;

const KEY_LENGTH: usize = 32;
const SALT_LENGTH: usize = 16;
const LOG_N: u8 = 14;
const R: u32 = 8;
const P: u32 = 1;

pub struct PinHash {
    pub salt: Vec<u8>,
    pub hash: Vec<u8>,
}

fn derive(pin: &Pin, salt: &[u8]) -> [u8; KEY_LENGTH] {
    let params = Params::new(LOG_N, R, P).expect("valid scrypt parameters");
    let mut key = [0; KEY_LENGTH];
    scrypt::scrypt(pin.as_bytes(), salt, &params, &mut key).expect("valid scrypt output length");
    key
}

impl PinHash {
    pub fn new(pin: &Pin) -> Self {
        let salt = rand::random::<[u8; SALT_LENGTH]>();
        Self { salt: salt.to_vec(), hash: derive(pin, &salt).to_vec() }
    }

    pub fn matches(&self, pin: &Pin) -> bool {
        derive(pin, &self.salt)[..].ct_eq(&self.hash).into()
    }
}
