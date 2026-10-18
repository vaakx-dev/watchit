use tauri::webview::WebviewBuilder;
use tauri::window::{Color, WindowBuilder};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, Window, WindowEvent};

use crate::player::Player;
use crate::title_bar;

const MAIN: &str = "main";
const UI: &str = "ui";

pub fn create(app: &AppHandle, port: u16, hidden: bool) -> anyhow::Result<()> {
    let window = WindowBuilder::new(app, MAIN)
        .title("Watchit")
        .inner_size(1280.0, 720.0)
        .min_inner_size(500.0, 360.0)
        .decorations(false)
        .center()
        .visible(!hidden)
        .background_color(Color(0, 0, 0, 255))
        .build()?;
    let wid = window.hwnd()?.0 as isize;
    let size = window.inner_size()?.to_logical::<f64>(window.scale_factor()?);
    let url = WebviewUrl::External(format!("http://127.0.0.1:{port}").parse()?);
    let ui = WebviewBuilder::new(UI, url).transparent(true).auto_resize();
    let webview = window.add_child(ui, LogicalPosition::new(0.0, 0.0), LogicalSize::new(size.width, size.height))?;
    title_bar::attach(&window)?;
    app.manage(Player::start(webview, wid));
    Ok(())
}

pub fn show(app: &AppHandle) {
    let Some(window) = app.get_window(MAIN) else {
        return;
    };
    window.show().ok();
    window.unminimize().ok();
    window.set_focus().ok();
}

pub fn on_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        window.hide().ok();
        if let Some(player) = window.try_state::<Player>() {
            player.pause();
        }
    }
}
