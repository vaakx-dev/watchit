use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

const CONFIGURED_MARKER: &str = "autostart-configured";

pub fn enable_on_first_run(app: &AppHandle) -> anyhow::Result<()> {
    let marker = app.path().app_config_dir()?.join(CONFIGURED_MARKER);
    if marker.exists() {
        return Ok(());
    }
    app.autolaunch().enable()?;
    std::fs::create_dir_all(marker.parent().unwrap())?;
    std::fs::write(marker, "")?;
    Ok(())
}

pub fn is_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

pub fn set_enabled(app: &AppHandle, enabled: bool) -> anyhow::Result<()> {
    let autolaunch = app.autolaunch();
    if enabled {
        autolaunch.enable()?;
    } else {
        autolaunch.disable()?;
    }
    Ok(())
}
