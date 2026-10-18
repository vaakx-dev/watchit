use std::fs;
use std::path::Path;

fn main() {
    let libmpv = Path::new(env!("CARGO_MANIFEST_DIR")).join("libmpv");
    let dll = libmpv.join("libmpv-2.dll");
    println!("cargo:rerun-if-changed={}", dll.display());
    if !dll.exists() {
        panic!("{} is missing, run desktop/libmpv/fetch.ps1", dll.display());
    }
    import_library(&dll, &libmpv.join("mpv.lib"));
    println!("cargo:rustc-link-search=native={}", libmpv.display());
    for resource in ["../server/playback/resources/ffmpeg", "../web/dist"] {
        fs::create_dir_all(Path::new(env!("CARGO_MANIFEST_DIR")).join(resource)).unwrap();
    }
    let commands = tauri_build::AppManifest::new().commands(&[
        "mpv_message",
        "maximize_button_area",
        "show_system_menu",
        "check_for_updates",
        "install_update",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(commands)).expect("cannot run tauri build");
}

fn import_library(dll: &Path, lib: &Path) {
    let target = "x86_64-pc-windows-msvc";
    let exports = cc::windows_registry::find(target, "dumpbin.exe")
        .expect("dumpbin.exe not found, install the MSVC build tools")
        .arg("/exports")
        .arg(dll)
        .output()
        .expect("cannot run dumpbin");
    let listing = String::from_utf8_lossy(&exports.stdout);
    let names: Vec<&str> = listing
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let numeric = fields.len() >= 4 && fields[..3].iter().all(|f| u32::from_str_radix(f, 16).is_ok());
            numeric.then(|| fields[3])
        })
        .filter(|name| name.starts_with("mpv_"))
        .collect();
    assert!(!names.is_empty(), "no mpv exports found in {}", dll.display());
    let definition = lib.with_extension("def");
    fs::write(&definition, format!("LIBRARY libmpv-2.dll\nEXPORTS\n{}\n", names.join("\n"))).unwrap();
    let status = cc::windows_registry::find(target, "lib.exe")
        .expect("lib.exe not found, install the MSVC build tools")
        .arg(format!("/DEF:{}", definition.display()))
        .arg(format!("/OUT:{}", lib.display()))
        .arg("/MACHINE:X64")
        .arg("/NOLOGO")
        .status()
        .expect("cannot run lib.exe");
    assert!(status.success(), "lib.exe failed");
}
