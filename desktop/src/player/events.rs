use std::sync::mpsc::Receiver;
use std::thread;

use libmpv2::events::{Event, PropertyData};
use libmpv2::{EndFileReason, Format, Mpv};
use serde_json::{Value, json};
use tauri::{Emitter, Webview};

const FLAG_PROPS: &[&str] = &["pause", "paused-for-cache", "seeking", "eof-reached", "idle-active"];
const DOUBLE_PROPS: &[&str] = &["time-pos", "duration", "volume", "speed", "demuxer-cache-time"];
const JSON_PROPS: &[&str] = &["video-params", "video-target-params", "track-list", "metadata"];

pub fn format_of(prop: &str) -> Format {
    if FLAG_PROPS.contains(&prop) {
        Format::Flag
    } else if DOUBLE_PROPS.contains(&prop) {
        Format::Double
    } else {
        Format::String
    }
}

pub fn spawn(client: Mpv, observe_rx: Receiver<(String, Format)>, webview: Webview) {
    thread::spawn(move || {
        client.disable_deprecated_events().ok();
        loop {
            for (name, format) in observe_rx.try_iter() {
                if let Err(error) = client.observe_property(&name, format, 0) {
                    eprintln!("mpv: cannot observe {name}: {error:?}");
                }
            }
            let message = match client.wait_event(0.1) {
                Some(Ok(Event::PropertyChange { name, change, .. })) => {
                    json!(["mpv-prop-change", { "name": name, "data": prop_value(name, change) }])
                }
                Some(Ok(Event::EndFile(reason))) => {
                    json!(["mpv-event-ended", { "reason": end_reason(reason) }])
                }
                Some(Ok(Event::Shutdown)) => break,
                Some(Err(error)) => {
                    eprintln!("mpv event error: {error:?}");
                    continue;
                }
                _ => continue,
            };
            webview.emit("mpv", message).ok();
        }
    });
}

fn prop_value(name: &str, data: PropertyData) -> Value {
    match data {
        PropertyData::Flag(value) => json!(value),
        PropertyData::Int64(value) => json!(value),
        PropertyData::Double(value) => json!(value),
        PropertyData::OsdStr(value) => json!(value),
        PropertyData::Str(value) if JSON_PROPS.contains(&name) => {
            serde_json::from_str(value).unwrap_or_else(|_| json!(value))
        }
        PropertyData::Str(value) => json!(value),
    }
}

fn end_reason(reason: EndFileReason) -> &'static str {
    match reason {
        0 => "eof",
        2 => "stop",
        3 => "quit",
        4 => "error",
        5 => "redirect",
        _ => "other",
    }
}
