pub mod snap_button;

use tauri::Window;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND, DwmSetWindowAttribute};

fn round_corners(window: &Window) -> anyhow::Result<()> {
    let preference = DWMWCP_ROUND;
    unsafe {
        DwmSetWindowAttribute(HWND(window.hwnd()?.0), DWMWA_WINDOW_CORNER_PREFERENCE, (&raw const preference).cast(), size_of_val(&preference) as u32)?
    };
    Ok(())
}

pub fn attach(window: &Window) -> anyhow::Result<()> {
    window.set_resizable(true)?;
    round_corners(window)?;
    snap_button::create(window)
}
