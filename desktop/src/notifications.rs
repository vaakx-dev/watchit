use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::window;

pub fn open_window_on_click(app: &AppHandle) -> anyhow::Result<()> {
    let handle = app.clone();
    app.notification().on_action(move |_| window::show(&handle))?;
    Ok(())
}
