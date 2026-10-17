use std::time::Duration;

use reqwest::StatusCode;
use reqwest::header::{ACCEPT, RETRY_AFTER, USER_AGENT};
use std::sync::Mutex;

use serde::de::DeserializeOwned;
use tokio::time::Instant;

use crate::cinemeta::error::SourceError;

const ATTEMPTS: u32 = 3;
const TIMEOUT: Duration = Duration::from_secs(15);
const BUDGET: Duration = Duration::from_secs(45);
const BACKOFF: Duration = Duration::from_secs(5);
const RETRYABLE: [u16; 4] = [429, 502, 503, 504];

struct Cooldown {
    until: Instant,
    error: SourceError,
}

pub(crate) struct Client {
    http: reqwest::Client,
    cooldown: Mutex<Option<Cooldown>>,
}

fn retry_delay(header: Option<&str>, minimum: Duration) -> Duration {
    let Some(header) = header.map(str::trim).filter(|header| !header.is_empty()) else { return minimum };
    let wait = match header.parse::<f64>() {
        Ok(seconds) if seconds >= 0.0 => Some(Duration::from_secs_f64(seconds)),
        _ => chrono::DateTime::parse_from_rfc2822(header)
            .ok()
            .and_then(|until| (until.timestamp_millis() - chrono::Utc::now().timestamp_millis()).try_into().ok())
            .map(Duration::from_millis),
    };
    wait.map_or(minimum, |wait| wait.max(minimum))
}

impl Client {
    pub fn new() -> Self {
        let http = reqwest::Client::builder().connect_timeout(TIMEOUT).build().expect("cinemeta http client");
        Self { http, cooldown: Mutex::new(None) }
    }

    fn ready_at(&self) -> Instant {
        self.cooldown.lock().unwrap().as_ref().map_or_else(Instant::now, |cooldown| cooldown.until)
    }

    fn cool_down(&self, until: Instant, error: SourceError) {
        let mut cooldown = self.cooldown.lock().unwrap();
        if cooldown.as_ref().is_none_or(|current| current.until < until) {
            *cooldown = Some(Cooldown { until, error });
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, url: &str) -> Result<T, SourceError> {
        let deadline = Instant::now() + BUDGET;
        for attempt in 0..ATTEMPTS {
            let ready = self.ready_at();
            if ready >= deadline {
                return Err(self.unavailable());
            }
            tokio::time::sleep_until(ready).await;
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(self.unavailable());
            }
            match self.attempt::<T>(url, remaining.min(TIMEOUT)).await {
                Ok(value) => return Ok(value),
                Err(Failure::Final(error)) => return Err(error),
                Err(Failure::Retry { error, retry_after }) => {
                    let backoff = BACKOFF * 2u32.pow(attempt);
                    self.cool_down(Instant::now() + retry_delay(retry_after.as_deref(), backoff), error);
                }
            }
        }
        Err(self.unavailable())
    }

    fn unavailable(&self) -> SourceError {
        let cooldown = self.cooldown.lock().unwrap();
        match cooldown.as_ref().filter(|cooldown| cooldown.until > Instant::now()) {
            None => SourceError::new(503, "Cinemeta request timed out."),
            Some(cooldown) => {
                let wait = cooldown.until.saturating_duration_since(Instant::now());
                SourceError { status: 503, message: cooldown.error.message.clone(), retry_after: Some(wait.as_millis().div_ceil(1000) as u64) }
            }
        }
    }

    async fn attempt<T: DeserializeOwned>(&self, url: &str, timeout: Duration) -> Result<T, Failure> {
        let response = self
            .http
            .get(url)
            .timeout(timeout)
            .header(ACCEPT, "application/json")
            .header(USER_AGENT, "Watchit/0.1 (self-hosted Cinemeta catalog)")
            .send()
            .await
            .map_err(|error| Failure::network(&error))?;
        let status = response.status();
        if status.is_success() {
            return response.json::<T>().await.map_err(|error| Failure::network(&error));
        }
        let error = SourceError::new(status.as_u16(), format!("Cinemeta request failed (HTTP {}).", status.as_u16()));
        if !RETRYABLE.contains(&status.as_u16()) {
            return Err(Failure::Final(error));
        }
        let retry_after = response.headers().get(RETRY_AFTER).and_then(|value| value.to_str().ok()).map(str::to_owned);
        Err(Failure::Retry { error, retry_after })
    }
}

enum Failure {
    Final(SourceError),
    Retry { error: SourceError, retry_after: Option<String> },
}

impl Failure {
    fn network(error: &reqwest::Error) -> Self {
        let cause = std::error::Error::source(error).map_or_else(|| error.to_string(), ToString::to_string);
        Self::Retry {
            error: SourceError::new(StatusCode::SERVICE_UNAVAILABLE.as_u16(), format!("Cinemeta request failed: {cause}.")),
            retry_after: None,
        }
    }
}
