#[allow(clippy::enum_variant_names)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reason {
    ContainerNotSupported,
    VideoCodecNotSupported,
    VideoProfileNotSupported,
    VideoBitDepthNotSupported,
    VideoResolutionNotSupported,
    VideoRangeTypeNotSupported,
    AudioCodecNotSupported,
    SecondaryAudioNotSupported,
    SubtitleCodecNotSupported,
}

impl Reason {
    pub fn allows_video_copy(self) -> bool {
        matches!(
            self,
            Self::ContainerNotSupported | Self::AudioCodecNotSupported | Self::SecondaryAudioNotSupported
        )
    }
}
