pub mod bridge;
mod display;
mod events;
mod options;

use std::sync::mpsc::{Sender, channel};
use std::sync::{Arc, Mutex};

use libmpv2::{Format, Mpv};
use tauri::Webview;


pub struct Player {
    mpv: Arc<Mpv>,
    observe: Mutex<Sender<(String, Format)>>,
}

impl Player {
    pub fn start(webview: Webview, wid: isize) -> Self {
        let mpv = Arc::new(options::create(wid));
        let client = mpv.create_client(None).expect("cannot create mpv event client");
        let (observe, observe_rx) = channel();
        events::spawn(client, observe_rx, webview);
        display::spawn_output_thread(Arc::clone(&mpv), wid);
        Self { mpv, observe: Mutex::new(observe) }
    }

    pub fn pause(&self) {
        if let Err(error) = self.mpv.set_property("pause", true) {
            eprintln!("mpv: cannot pause: {error:?}");
        }
    }
}
