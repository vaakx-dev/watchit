use crate::decide::VideoTarget;
use crate::probe::{Transfer, VideoStream};

const TONEMAP_CUDA: &str = "tonemap_cuda=format=yuv420p:p=bt709:t=bt709:m=bt709:tonemap=bt2390:peak=100:desat=0";
const TONEMAP_CPU: &str = "format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
pub const HEVC_TAG: &str = "hvc1";
const H264_BITRATE_1080P: f64 = 10_000_000.0;
const MIN_BITRATE: f64 = 2_000_000.0;
const MAX_BITRATE: f64 = 30_000_000.0;

#[derive(Clone, Debug)]
pub struct Encode {
    pub stream: u32,
    pub target: VideoTarget,
    pub nvenc: bool,
    pub gpu_decode: bool,
    pub ten_bit: bool,
    pub source_transfer: Transfer,
    pub gop: u32,
    pub burn_in: Option<u32>,
}

impl Encode {
    pub fn new(video: &VideoStream, target: VideoTarget, nvenc: bool, gop: u32, burn_in: Option<u32>) -> Self {
        let source_transfer = if video.dolby_vision.is_some() { Transfer::Pq } else { video.transfer };
        Self { stream: video.index, target, nvenc, gpu_decode: nvenc && nvdec_decodes(video), ten_bit: video.bit_depth > 8, source_transfer, gop, burn_in }
    }

    pub fn input_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if self.nvenc {
            args.extend(strings(&["-init_hw_device", "cuda=cu:0", "-filter_hw_device", "cu"]));
        }
        if self.gpu_decode {
            args.extend(strings(&["-hwaccel", "cuda", "-hwaccel_output_format", "cuda", "-hwaccel_flags", "+unsafe_output", "-threads", "1"]));
        }
        args
    }

    pub fn output_args(&self) -> Vec<String> {
        let graph = if self.nvenc { self.gpu_graph() } else { self.cpu_graph() };
        let mut args = strings(&["-filter_complex", &graph, "-map", "[v]"]);
        args.extend(self.codec_args());
        args
    }

    fn gpu_graph(&self) -> String {
        let VideoTarget { width, height, keep_hdr, tonemap } = self.target;
        let mut graph = format!("[0:{}]", self.stream);
        if !self.gpu_decode {
            graph += &format!("format={},hwupload,", if self.ten_bit { "p010le" } else { "nv12" });
        }
        if tonemap {
            graph += &format!("setparams=color_primaries=bt2020:color_trc={}:colorspace=bt2020nc,scale_cuda=w={width}:h={height},{TONEMAP_CUDA}", trc(self.source_transfer));
        } else {
            let format = if keep_hdr.is_some() { "p010le" } else { "yuv420p" };
            graph += &format!("scale_cuda=w={width}:h={height}:format={format}");
        }
        if let Some(subtitle) = self.burn_in {
            graph += &format!(
                "[main];[0:{subtitle}]scale={width}:{height}:force_original_aspect_ratio=decrease,format=yuva420p,hwupload[sub];[main][sub]overlay_cuda=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:eof_action=pass:repeatlast=0"
            );
        }
        graph + "[v]"
    }

    fn cpu_graph(&self) -> String {
        let VideoTarget { width, height, tonemap, .. } = self.target;
        let mut graph = format!("[0:{}]", self.stream);
        if tonemap {
            graph += &format!("zscale=w={width}:h={height}:t=linear:npl=100,{TONEMAP_CPU}");
        } else {
            graph += &format!("scale={width}:{height},format=yuv420p");
        }
        if let Some(subtitle) = self.burn_in {
            graph += &format!(
                "[main];[0:{subtitle}]scale={width}:{height}:force_original_aspect_ratio=decrease[sub];[main][sub]overlay=x=(W-w)/2:y=(H-h)/2:eof_action=pass:repeatlast=0,format=yuv420p"
            );
        }
        graph + "[v]"
    }

    fn codec_args(&self) -> Vec<String> {
        let h264_bitrate = h264_bitrate(self.target.width, self.target.height);
        let gop = self.gop.to_string();
        let gop_args = ["-g:v:0", &gop, "-keyint_min:v:0", &gop];
        let mut args = match (self.nvenc, self.target.keep_hdr) {
            (true, Some(transfer)) => {
                let mut args = strings(&["-c:v", "hevc_nvenc", "-preset", "p4", "-profile:v", "main10", "-tag:v", HEVC_TAG, "-spatial-aq", "1", "-aq-strength", "15"]);
                args.extend(bitrate_args(h264_bitrate * 2 / 3));
                args.extend(strings(&["-color_primaries", "bt2020", "-color_trc", trc(transfer), "-colorspace", "bt2020nc"]));
                args
            }
            (true, None) => {
                let mut args = strings(&["-c:v", "h264_nvenc", "-preset", "p4", "-profile:v", "high"]);
                args.extend(bitrate_args(h264_bitrate));
                args
            }
            (false, _) => {
                let mut args = strings(&["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-sc_threshold:v:0", "0"]);
                args.extend(strings(&["-maxrate", &h264_bitrate.to_string(), "-bufsize", &(h264_bitrate * 2).to_string()]));
                args
            }
        };
        args.extend(strings(&gop_args));
        args
    }
}

fn nvdec_decodes(video: &VideoStream) -> bool {
    let eight_bit = matches!(video.pixel_format.as_str(), "yuv420p" | "yuvj420p" | "nv12");
    let ten_bit = matches!(video.pixel_format.as_str(), "yuv420p10le" | "p010le");
    match video.codec.as_str() {
        "hevc" | "av1" | "vp9" => eight_bit || ten_bit,
        "h264" | "mpeg2video" | "vc1" | "vp8" | "mpeg4" => eight_bit,
        _ => false,
    }
}

fn trc(transfer: Transfer) -> &'static str {
    match transfer {
        Transfer::Hlg => "arib-std-b67",
        Transfer::Pq | Transfer::Sdr => "smpte2084",
    }
}

fn h264_bitrate(width: u32, height: u32) -> u64 {
    let pixels = f64::from(width) * f64::from(height);
    (H264_BITRATE_1080P * pixels / (1920.0 * 1080.0)).clamp(MIN_BITRATE, MAX_BITRATE) as u64
}

fn bitrate_args(bitrate: u64) -> Vec<String> {
    strings(&["-b:v", &bitrate.to_string(), "-maxrate", &bitrate.to_string(), "-bufsize", &(bitrate * 2).to_string()])
}

pub fn strings(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| (*arg).to_owned()).collect()
}
