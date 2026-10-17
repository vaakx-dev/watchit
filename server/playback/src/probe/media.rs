#[derive(Clone, Debug)]
pub struct Media {
    pub formats: Vec<String>,
    pub start: f64,
    pub duration: Option<f64>,
    pub video: Option<VideoStream>,
    pub audio: Vec<AudioStream>,
    pub subtitles: Vec<SubtitleStream>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Transfer {
    Sdr,
    Pq,
    Hlg,
}

#[derive(Clone, Copy, Debug)]
pub struct DolbyVision {
    pub base: Option<Transfer>,
}

#[derive(Clone, Debug)]
pub struct VideoStream {
    pub index: u32,
    pub codec: String,
    pub pixel_format: String,
    pub bit_depth: u32,
    pub width: u32,
    pub height: u32,
    pub frame_rate: Option<f64>,
    pub transfer: Transfer,
    pub dolby_vision: Option<DolbyVision>,
}

#[derive(Clone, Debug)]
pub struct AudioStream {
    pub index: u32,
    pub codec: String,
    pub channels: u32,
    pub language: Option<String>,
    pub title: Option<String>,
    pub default: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SubtitleKind {
    Text,
    Image,
    Other,
}

#[derive(Clone, Debug)]
pub struct SubtitleStream {
    pub index: u32,
    pub codec: String,
    pub kind: SubtitleKind,
    pub language: Option<String>,
    pub title: Option<String>,
    pub default: bool,
}

impl Media {
    pub fn is_matroska(&self) -> bool {
        self.formats.iter().any(|format| format == "matroska")
    }

    pub fn audio(&self, index: u32) -> Option<&AudioStream> {
        self.audio.iter().find(|stream| stream.index == index)
    }

    pub fn subtitle(&self, index: u32) -> Option<&SubtitleStream> {
        self.subtitles.iter().find(|stream| stream.index == index)
    }

    pub fn default_audio(&self) -> Option<&AudioStream> {
        self.audio.iter().find(|stream| stream.default).or_else(|| self.audio.first())
    }
}

impl VideoStream {
    pub fn hdr_label(&self) -> Option<&'static str> {
        if self.dolby_vision.is_some() {
            return Some("DV");
        }
        match self.transfer {
            Transfer::Sdr => None,
            Transfer::Pq => Some("HDR10"),
            Transfer::Hlg => Some("HLG"),
        }
    }

    pub fn displayed_transfer(&self) -> Option<Transfer> {
        match self.dolby_vision {
            Some(dolby_vision) => dolby_vision.base,
            None => Some(self.transfer),
        }
    }

    pub fn is_hdr(&self) -> bool {
        self.dolby_vision.is_some() || self.transfer != Transfer::Sdr
    }
}
