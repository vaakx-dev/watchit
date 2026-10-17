use std::time::Duration;

use reqwest::StatusCode;
use reqwest::header::{ACCEPT, RETRY_AFTER, USER_AGENT};
use serde::de::DeserializeOwned;
use tokio::sync::Mutex;
use tokio::time::Instant;

use crate::cinemeta::error::SourceError;

const ATTEMPTS: u32 = 3;
const TIMEOUT: Duration = Duration::from_secs(15);
const BUDGET: Duration = Duration::from_secs(45);
const BACKOFF: Duration = Duration::from_secs(5);
const INTERVAL: Duration = Duration::from_secs(1);
const RETRYABLE: [u16; 4] = [429, 502, 503, 504];

struct Cooldown {
    until: Instant,
    error: SourceError,
}

struct Pace {
    next_request: Instant,
    cooldown: Option<Cooldown>,
}

pub(crate) struct Client {
    http: reqwest::Client,
    pace: Mutex<Pace>,
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
        Self { http, pace: Mutex::new(Pace { next_request: Instant::now(), cooldown: None }) }
    }

    pub async fn get<T: DeserializeOwned>(&self, url: &str) -> Result<T, SourceError> {
        let mut pace = self.pace.lock().await;
        let deadline = Instant::now() + BUDGET;
        for attempt in 0..ATTEMPTS {
            let ready = pace.cooldown.as_ref().map_or(pace.next_request, |cooldown| cooldown.until.max(pace.next_request));
            if ready >= deadline {
                return Err(unavailable(&pace));
            }
            tokio::time::sleep_until(ready).await;
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(unavailable(&pace));
            }
            pace.cooldown = None;
            let backoff = BACKOFF * 2u32.pow(attempt);
            let result = self.attempt::<T>(url, remaining.min(TIMEOUT)).await;
            pace.next_request = Instant::now() + INTERVAL;
            match result {
                Ok(value) => return Ok(value),
                Err(Failure::Final(error)) => return Err(error),
                Err(Failure::Retry { error, retry_after }) => {
                    pace.cooldown = Some(Cooldown { until: Instant::now() + retry_delay(retry_after.as_deref(), backoff), error });
                }
            }
        }
        Err(unavailable(&pace))
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

fn unavailable(pace: &Pace) -> SourceError {
    match &pace.cooldown {
        None => SourceError::new(503, "Cinemeta request timed out while queued."),
        Some(cooldown) => {
            let wait = cooldown.until.saturating_duration_since(Instant::now());
            SourceError { status: 503, message: cooldown.error.message.clone(), retry_after: Some(wait.as_millis().div_ceil(1000) as u64) }
        }
    }
}
