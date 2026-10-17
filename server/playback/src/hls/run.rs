use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, ChildStderr};
use tokio::sync::oneshot;

use watchit_core::Background;

use super::fragments::{segment_index, segment_name};
use crate::ffmpeg::Tools;

const TAIL_LINES: usize = 30;

pub enum RunEvent {
    Segment(usize, PathBuf),
    Exit(RunExit),
}

#[derive(Clone, Debug)]
pub enum RunExit {
    Finished,
    Stopped,
    Failed(String),
}

pub fn spawn(tools: &Tools, background: &Background, directory: &Path, args: &[String], stop: oneshot::Receiver<()>, on_event: impl Fn(RunEvent) + Send + Sync + 'static) -> std::io::Result<()> {
    std::fs::create_dir_all(directory)?;
    tracing::debug!(args = %args.join(" "), "ffmpeg");
    let mut child = tools.ffmpeg().args(args).current_dir(directory).stdout(Stdio::null()).stderr(Stdio::piped()).spawn()?;
    let stderr = child.stderr.take().expect("stderr is piped");
    let directory = directory.to_path_buf();
    background.spawn(async move {
        let reading = read_stderr(stderr, directory, &on_event);
        let (status, stopped, tail) = supervise(child, stop, reading).await;
        let exit = match status {
            _ if stopped => RunExit::Stopped,
            Ok(status) if status.success() => RunExit::Finished,
            Ok(status) => RunExit::Failed(format!("ffmpeg exited with {status}: {tail}")),
            Err(error) => RunExit::Failed(error.to_string()),
        };
        if let RunExit::Failed(error) = &exit {
            tracing::warn!(%error, "ffmpeg run failed");
        }
        on_event(RunEvent::Exit(exit));
    });
    Ok(())
}

async fn supervise(mut child: Child, mut stop: oneshot::Receiver<()>, reading: impl Future<Output = String>) -> (std::io::Result<ExitStatus>, bool, String) {
    let waiting = async {
        let stopped = tokio::select! {
            _ = child.wait() => false,
            _ = &mut stop => {
                let _ = child.kill().await;
                true
            }
        };
        (child.wait().await, stopped)
    };
    let ((status, stopped), tail) = tokio::join!(waiting, reading);
    (status, stopped, tail)
}

async fn read_stderr(stderr: ChildStderr, directory: PathBuf, on_event: &impl Fn(RunEvent)) -> String {
    let mut reader = BufReader::new(stderr);
    let mut tail = VecDeque::with_capacity(TAIL_LINES);
    let mut buffer = Vec::new();
    while reader.read_until(b'\n', &mut buffer).await.is_ok_and(|read| read > 0) {
        let line = String::from_utf8_lossy(&buffer).trim_end().to_owned();
        buffer.clear();
        if let Some(index) = ended_segment(&line) {
            on_event(RunEvent::Segment(index, directory.join(segment_name(index))));
        }
        if tail.len() == TAIL_LINES {
            tail.pop_front();
        }
        tail.push_back(line);
    }
    Vec::from(tail).join("\n")
}

fn ended_segment(line: &str) -> Option<usize> {
    let rest = line.split_once("segment:'")?.1;
    let (name, after) = rest.split_once('\'')?;
    if !after.ends_with(" ended") {
        return None;
    }
    segment_index(name)
}
