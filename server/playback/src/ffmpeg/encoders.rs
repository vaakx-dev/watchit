use std::time::Duration;

use super::Tools;

const TEST_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, Debug, Default)]
pub struct Encoders {
    pub h264_nvenc: bool,
    pub hevc_nvenc: bool,
}

struct Probe {
    encoder: &'static str,
    format: &'static str,
    options: &'static [&'static str],
}

const PROBES: [Probe; 3] = [
    Probe { encoder: "h264_nvenc", format: "yuv420p", options: &["-preset", "p4", "-profile:v", "high"] },
    Probe { encoder: "hevc_nvenc", format: "p010le", options: &["-preset", "p4", "-profile:v", "main10"] },
    Probe { encoder: "av1_nvenc", format: "yuv420p", options: &["-preset", "p4"] },
];

pub async fn detect(tools: &Tools) -> Encoders {
    let mut working = Vec::new();
    for probe in &PROBES {
        if works(tools, probe).await {
            working.push(probe.encoder);
        }
    }
    tracing::info!(?working, "hardware video encoders");
    Encoders { h264_nvenc: working.contains(&"h264_nvenc"), hevc_nvenc: working.contains(&"hevc_nvenc") }
}

async fn works(tools: &Tools, probe: &Probe) -> bool {
    let filter = format!("format=nv12,hwupload,scale_cuda=format={}", probe.format);
    let mut command = tools.ffmpeg();
    command
        .args(["-hide_banner", "-v", "error", "-init_hw_device", "cuda=cu:0", "-filter_hw_device", "cu"])
        .args(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24:duration=0.5", "-vf", &filter, "-c:v", probe.encoder])
        .args(probe.options)
        .args(["-f", "null", "-"]);
    let output = match tokio::time::timeout(TEST_TIMEOUT, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(error)) => {
            tracing::warn!(encoder = probe.encoder, %error, "ffmpeg could not start");
            return false;
        }
        Err(_) => {
            tracing::warn!(encoder = probe.encoder, "encoder test timed out");
            return false;
        }
    };
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        tracing::warn!(encoder = probe.encoder, stderr = %stderr.trim(), "encoder test failed");
    }
    output.status.success()
}
