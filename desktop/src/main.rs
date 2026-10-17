#![windows_subsystem = "windows"]

mod autostart;
mod notifications;
mod player;
mod server;
mod title_bar;
mod tools;
mod tray;
mod updates;
mod window;

use tauri_plugin_autostart::MacosLauncher;

const HIDDEN_ARG: &str = "--hidden";

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| window::show(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle();
            let port = server::start(handle)?;
            let hidden = std::env::args().any(|arg| arg == HIDDEN_ARG);
            window::create(handle, port, hidden)?;
            autostart::enable_on_first_run(handle)?;
            tray::create(handle)?;
            notifications::open_window_on_click(handle)?;
            updates::spawn_checks(handle);
            Ok(())
        })
        .on_window_event(window::on_event)
        .invoke_handler(tauri::generate_handler![player::bridge::mpv_message, title_bar::snap_button::maximize_button_area, title_bar::system_menu::show_system_menu])
        .build(tauri::generate_context!())
        .expect("cannot build the Watchit app")
        .run(server::on_run_event);
}
