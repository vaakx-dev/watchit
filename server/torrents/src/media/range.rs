use axum::http::{HeaderMap, header};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

impl ByteRange {
    pub fn len(self) -> u64 {
        self.end - self.start + 1
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Requested {
    Whole,
    Part(ByteRange),
    Unsatisfiable,
}

pub fn requested(headers: &HeaderMap, len: u64) -> Requested {
    let Some(spec) = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().strip_prefix("bytes="))
    else {
        return Requested::Whole;
    };
    if spec.contains(',') {
        return Requested::Whole;
    }
    let Some((start, end)) = spec.split_once('-') else {
        return Requested::Whole;
    };
    let last = len.saturating_sub(1);
    let (start, end) = match (start.trim().parse::<u64>().ok(), end.trim().parse::<u64>().ok()) {
        (Some(start), Some(end)) => (start, end.min(last)),
        (Some(start), None) if end.trim().is_empty() => (start, last),
        (None, Some(suffix)) if start.trim().is_empty() && suffix > 0 => (len.saturating_sub(suffix), last),
        _ => return Requested::Whole,
    };
    if len == 0 || start >= len || start > end {
        return Requested::Unsatisfiable;
    }
    Requested::Part(ByteRange { start, end })
}
