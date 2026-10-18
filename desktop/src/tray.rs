use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::updates::Updates;
use crate::{autostart, updates, window};

const OPEN: &str = "open";
const AUTOSTART: &str = "autostart";
const UPDATES: &str = "updates";
const QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> anyhow::Result<()> {
    let open = MenuItem::with_id(app, OPEN, "Open Watchit", true, None::<&str>)?;
    let start_with_windows = CheckMenuItem::with_id(app, AUTOSTART, "Start with Windows", true, autostart::is_enabled(app), None::<&str>)?;
    let check_updates = MenuItem::with_id(app, UPDATES, "Check for updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &start_with_windows, &check_updates, &separator, &quit])?;
    app.manage(Updates::new(check_updates));

    let icon = app.default_window_icon().cloned().ok_or_else(|| anyhow::anyhow!("missing app icon"))?;
    TrayIconBuilder::with_id("watchit")
        .icon(icon)
        .tooltip("Watchit")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(on_tray_event)
        .on_menu_event(move |app, event| on_menu_event(app, &event, &start_with_windows))
        .build(app)?;
    Ok(())
}

fn on_tray_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        window::show(tray.app_handle());
    }
}

fn on_menu_event(app: &AppHandle, event: &MenuEvent, start_with_windows: &CheckMenuItem<Wry>) {
    match event.id().as_ref() {
        OPEN => window::show(app),
        AUTOSTART => toggle_autostart(app, start_with_windows),
        UPDATES => updates::activate(app),
        QUIT => app.exit(0),
        _ => {}
    }
}

fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<Wry>) {
    let wanted = item.is_checked().unwrap_or(false);
    if let Err(error) = autostart::set_enabled(app, wanted) {
        eprintln!("autostart: {error}");
    }
    item.set_checked(autostart::is_enabled(app)).ok();
}
