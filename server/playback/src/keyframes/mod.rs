mod bytes;
mod ebml;
mod matroska;

use crate::probe::Media;
use crate::source::SourceInput;

pub async fn keyframes(input: &SourceInput, media: &Media) -> Option<Vec<f64>> {
    if !media.is_matroska() {
        return None;
    }
    let reader = bytes::ByteReader::new(input.clone());
    match matroska::keyframes(&reader).await {
        Ok(times) if !times.is_empty() => Some(times.into_iter().map(|time| time - media.start).filter(|time| *time >= 0.0).collect()),
        Ok(_) => None,
        Err(error) => {
            tracing::warn!(%error, "no keyframes from Matroska cues");
            None
        }
    }
}
