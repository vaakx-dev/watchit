use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

use serde::Deserialize;
use tauri::{Emitter, Window};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT, TrackMouseEvent};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetParent, HTMAXBUTTON, HWND_TOP, IDC_ARROW, IsZoomed, LoadCursorW, RegisterClassExW,
    SWP_ASYNCWINDOWPOS, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, SetWindowPos,
    WINDOW_EX_STYLE, WM_NCHITTEST, WM_NCLBUTTONDBLCLK, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_NCMOUSELEAVE, WM_NCMOUSEMOVE,
    WNDCLASSEXW, WS_CHILD, WS_CLIPSIBLINGS,
};
use windows::core::w;

const EVENT: &str = "maximize-button";

static WINDOW: OnceLock<Window> = OnceLock::new();
static BUTTON: AtomicIsize = AtomicIsize::new(0);
static HOVERED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
pub struct Area {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn emit(state: &str) {
    if let Some(window) = WINDOW.get() {
        window.emit(EVENT, state).ok();
    }
}

fn toggle_maximized(button: HWND) {
    let (Some(window), Ok(parent)) = (WINDOW.get(), unsafe { GetParent(button) }) else {
        return;
    };
    let toggled = if unsafe { IsZoomed(parent) }.as_bool() { window.unmaximize() } else { window.maximize() };
    if let Err(error) = toggled {
        eprintln!("title bar: cannot toggle maximize: {error}");
    }
}

fn track_leave(button: HWND) {
    let mut track = TRACKMOUSEEVENT {
        cbSize: size_of::<TRACKMOUSEEVENT>() as u32,
        dwFlags: TME_LEAVE | TME_NONCLIENT,
        hwndTrack: button,
        dwHoverTime: 0,
    };
    unsafe { TrackMouseEvent(&mut track) }.ok();
}

unsafe extern "system" fn procedure(button: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match message {
        WM_NCHITTEST => return LRESULT(HTMAXBUTTON as isize),
        WM_NCMOUSEMOVE if !HOVERED.swap(true, Ordering::Relaxed) => {
            track_leave(button);
            emit("hover");
        }
        WM_NCMOUSELEAVE => {
            HOVERED.store(false, Ordering::Relaxed);
            emit("leave");
        }
        WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK => {
            emit("press");
            return LRESULT(0);
        }
        WM_NCLBUTTONUP => {
            emit("hover");
            toggle_maximized(button);
            return LRESULT(0);
        }
        _ => {}
    }
    unsafe { DefWindowProcW(button, message, wparam, lparam) }
}

pub fn create(window: &Window) -> anyhow::Result<()> {
    let parent = HWND(window.hwnd()?.0);
    let instance = unsafe { GetModuleHandleW(None)? }.into();
    let class_name = w!("WatchitMaximizeButton");
    let class = WNDCLASSEXW {
        cbSize: size_of::<WNDCLASSEXW>() as u32,
        lpfnWndProc: Some(procedure),
        hInstance: instance,
        hCursor: unsafe { LoadCursorW(None, IDC_ARROW)? },
        lpszClassName: class_name,
        ..Default::default()
    };
    unsafe { RegisterClassExW(&class) };
    let button = unsafe {
        CreateWindowExW(WINDOW_EX_STYLE::default(), class_name, None, WS_CHILD | WS_CLIPSIBLINGS, 0, 0, 0, 0, Some(parent), None, Some(instance), None)?
    };
    BUTTON.store(button.0 as isize, Ordering::Relaxed);
    WINDOW.set(window.clone()).ok();
    Ok(())
}

#[tauri::command]
pub fn maximize_button_area(area: Option<Area>) -> Result<(), String> {
    let button = HWND(BUTTON.load(Ordering::Relaxed) as _);
    let flags = SWP_ASYNCWINDOWPOS | SWP_NOACTIVATE;
    let placed = match area {
        Some(area) => unsafe {
            SetWindowPos(button, Some(HWND_TOP), area.x.round() as i32, area.y.round() as i32, area.width.round() as i32, area.height.round() as i32, flags | SWP_SHOWWINDOW)
        },
        None => {
            HOVERED.store(false, Ordering::Relaxed);
            let hide = flags | SWP_HIDEWINDOW | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER;
            unsafe { SetWindowPos(button, None, 0, 0, 0, 0, hide) }
        }
    };
    placed.map_err(|error| error.to_string())
}
