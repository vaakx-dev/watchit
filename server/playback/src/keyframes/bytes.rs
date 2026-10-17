use std::io::SeekFrom;

use axum::http::{StatusCode, header};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use crate::source::SourceInput;

pub struct ByteReader {
    input: SourceInput,
    client: reqwest::Client,
}

impl ByteReader {
    pub fn new(input: SourceInput) -> Self {
        Self { input, client: reqwest::Client::new() }
    }

    pub async fn read(&self, start: u64, length: u64) -> Result<Vec<u8>, String> {
        match &self.input {
            SourceInput::Url(url) => self.read_url(url, start, length).await,
            SourceInput::File(path) => {
                let mut file = tokio::fs::File::open(path).await.map_err(|error| error.to_string())?;
                file.seek(SeekFrom::Start(start)).await.map_err(|error| error.to_string())?;
                let mut bytes = Vec::with_capacity(length as usize);
                file.take(length).read_to_end(&mut bytes).await.map_err(|error| error.to_string())?;
                Ok(bytes)
            }
        }
    }

    async fn read_url(&self, url: &str, start: u64, length: u64) -> Result<Vec<u8>, String> {
        let range = format!("bytes={start}-{}", start + length - 1);
        let response = self.client.get(url).header(header::RANGE, range).send().await.map_err(|error| error.to_string())?;
        if response.status() != StatusCode::PARTIAL_CONTENT {
            return Err(format!("Range request failed with {}", response.status()));
        }
        Ok(response.bytes().await.map_err(|error| error.to_string())?.to_vec())
    }
}
