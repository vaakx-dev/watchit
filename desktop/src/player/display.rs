use std::mem;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use libmpv2::Mpv;
use windows::Win32::Devices::Display::{
    DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_HEADER, DISPLAYCONFIG_DEVICE_INFO_TYPE, DISPLAYCONFIG_MODE_INFO,
    DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME, DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QDC_ONLY_ACTIVE_PATHS,
    QueryDisplayConfig,
};
use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS, HWND};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MONITORINFOEXW, MonitorFromWindow};

const GET_ADVANCED_COLOR_INFO_2: i32 = 15;
const ADVANCED_COLOR_MODE_HDR: u32 = 2;

#[repr(C)]
struct AdvancedColorInfo2 {
    header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
    value: u32,
    color_encoding: u32,
    bits_per_color_channel: u32,
    active_color_mode: u32,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum OutputMode {
    Hdr,
    Sdr,
    Auto,
}

pub fn spawn_output_thread(mpv: Arc<Mpv>, wid: isize) {
    thread::spawn(move || {
        let mut last = None;
        loop {
            let mode = current_mode(HWND(wid as _));
            if last != Some(mode) {
                println!("[display] output mode {mode:?}");
                apply(&mpv, mode);
                last = Some(mode);
            }
            thread::sleep(Duration::from_millis(500));
        }
    });
}

fn apply(mpv: &Mpv, mode: OutputMode) {
    let color = match mode {
        OutputMode::Hdr | OutputMode::Auto => [
            ("d3d11-output-csp", "auto"),
            ("target-colorspace-hint", "auto"),
            ("target-trc", "auto"),
            ("target-prim", "auto"),
        ],
        OutputMode::Sdr => [
            ("d3d11-output-csp", "srgb"),
            ("target-colorspace-hint", "yes"),
            ("target-trc", "auto"),
            ("target-prim", "bt.709"),
        ],
    };
    for (name, value) in color {
        if let Err(error) = mpv.set_property(name, value) {
            eprintln!("mpv: cannot set {name}={value}: {error:?}");
        }
    }
}

fn current_mode(hwnd: HWND) -> OutputMode {
    match monitor_hdr_active(hwnd) {
        Some(true) => OutputMode::Hdr,
        Some(false) => OutputMode::Sdr,
        None => OutputMode::Auto,
    }
}

fn monitor_hdr_active(hwnd: HWND) -> Option<bool> {
    let device = monitor_device_name(hwnd)?;
    active_paths()?
        .iter()
        .find(|path| source_name(path).is_some_and(|name| name.viewGdiDeviceName == device))
        .and_then(hdr_active)
}

fn monitor_device_name(hwnd: HWND) -> Option<[u16; 32]> {
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    let mut info: MONITORINFOEXW = unsafe { mem::zeroed() };
    info.monitorInfo.cbSize = mem::size_of::<MONITORINFOEXW>() as u32;
    let ok = unsafe { GetMonitorInfoW(monitor, &mut info as *mut _ as *mut MONITORINFO) };
    ok.as_bool().then_some(info.szDevice)
}

fn active_paths() -> Option<Vec<DISPLAYCONFIG_PATH_INFO>> {
    for _ in 0..3 {
        let (mut path_count, mut mode_count) = (0u32, 0u32);
        let status = unsafe { GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count) };
        if status != ERROR_SUCCESS {
            return None;
        }
        let mut paths = vec![unsafe { mem::zeroed::<DISPLAYCONFIG_PATH_INFO>() }; path_count as usize];
        let mut modes = vec![unsafe { mem::zeroed::<DISPLAYCONFIG_MODE_INFO>() }; mode_count as usize];
        let status = unsafe {
            QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                None,
            )
        };
        if status == ERROR_SUCCESS {
            paths.truncate(path_count as usize);
            return Some(paths);
        }
        if status != ERROR_INSUFFICIENT_BUFFER {
            return None;
        }
    }
    None
}

fn source_name(path: &DISPLAYCONFIG_PATH_INFO) -> Option<DISPLAYCONFIG_SOURCE_DEVICE_NAME> {
    let mut name: DISPLAYCONFIG_SOURCE_DEVICE_NAME = unsafe { mem::zeroed() };
    name.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
        r#type: DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
        size: mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32,
        adapterId: path.sourceInfo.adapterId,
        id: path.sourceInfo.id,
    };
    (unsafe { DisplayConfigGetDeviceInfo(&mut name.header) } == 0).then_some(name)
}

fn hdr_active(path: &DISPLAYCONFIG_PATH_INFO) -> Option<bool> {
    let mut info: AdvancedColorInfo2 = unsafe { mem::zeroed() };
    info.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
        r#type: DISPLAYCONFIG_DEVICE_INFO_TYPE(GET_ADVANCED_COLOR_INFO_2),
        size: mem::size_of::<AdvancedColorInfo2>() as u32,
        adapterId: path.targetInfo.adapterId,
        id: path.targetInfo.id,
    };
    let status = unsafe { DisplayConfigGetDeviceInfo(&mut info.header) };
    (status == 0).then_some(info.active_color_mode == ADVANCED_COLOR_MODE_HDR)
}
