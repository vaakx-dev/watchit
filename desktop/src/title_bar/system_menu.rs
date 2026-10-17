use tauri::Window;
use windows::Win32::Foundation::{HWND, LPARAM, POINT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetSystemMenu, PostMessageW, SetForegroundWindow, TPM_RETURNCMD, TPM_RIGHTBUTTON, TrackPopupMenu, WM_SYSCOMMAND,
};

#[tauri::command]
pub fn show_system_menu(window: Window) -> Result<(), String> {
    let hwnd = HWND(window.hwnd().map_err(|error| error.to_string())?.0);
    unsafe {
        let menu = GetSystemMenu(hwnd, false);
        let mut cursor = POINT::default();
        GetCursorPos(&mut cursor).map_err(|error| error.to_string())?;
        let _ = SetForegroundWindow(hwnd);
        let command = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, cursor.x, cursor.y, None, hwnd, None).0;
        if command != 0 {
            PostMessageW(Some(hwnd), WM_SYSCOMMAND, WPARAM(command as usize), LPARAM(0)).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}
