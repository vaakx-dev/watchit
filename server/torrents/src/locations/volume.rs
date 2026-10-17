use std::path::{Path, PathBuf};

pub fn root_of(path: &Path) -> PathBuf {
    platform::root_of(path)
}

pub fn drives() -> Vec<PathBuf> {
    platform::drives().into_iter().filter(|drive| fs4::available_space(drive).is_ok()).collect()
}

pub fn free_bytes(path: &Path) -> u64 {
    fs4::available_space(path).unwrap_or(0)
}

pub fn same_volume(a: &Path, b: &Path) -> bool {
    root_of(a) == root_of(b)
}

pub fn is_hidden(path: &Path) -> bool {
    platform::is_hidden(path)
}

#[cfg(windows)]
mod platform {
    use std::ffi::OsString;
    use std::fs;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::os::windows::fs::MetadataExt;
    use std::path::{Path, PathBuf};

    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM, GetDriveTypeW, GetLogicalDrives, GetVolumePathNameW,
    };

    const DRIVE_UNKNOWN: u32 = 0;
    const DRIVE_NO_ROOT_DIR: u32 = 1;
    const VOLUME_PATH_CAPACITY: usize = 1024;
    const LETTERS: u8 = 26;

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn root_of(path: &Path) -> PathBuf {
        let mut buffer = vec![0u16; VOLUME_PATH_CAPACITY];
        let found = unsafe { GetVolumePathNameW(wide(path).as_ptr(), buffer.as_mut_ptr(), buffer.len() as u32) };
        if found == 0 {
            return path.ancestors().last().map_or_else(|| path.to_path_buf(), Path::to_path_buf);
        }
        let length = buffer.iter().position(|&unit| unit == 0).unwrap_or(buffer.len());
        PathBuf::from(OsString::from_wide(&buffer[..length]))
    }

    pub fn drives() -> Vec<PathBuf> {
        let present = unsafe { GetLogicalDrives() };
        (0..LETTERS)
            .filter(|bit| present & (1 << bit) != 0)
            .map(|bit| PathBuf::from(format!("{}:\\", char::from(b'A' + bit))))
            .filter(|root| !matches!(unsafe { GetDriveTypeW(wide(root).as_ptr()) }, DRIVE_UNKNOWN | DRIVE_NO_ROOT_DIR))
            .collect()
    }

    pub fn is_hidden(path: &Path) -> bool {
        fs::metadata(path).is_ok_and(|meta| meta.file_attributes() & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0)
    }
}

#[cfg(not(windows))]
mod platform {
    use std::path::{Path, PathBuf};

    pub fn root_of(_: &Path) -> PathBuf {
        PathBuf::from("/")
    }

    pub fn drives() -> Vec<PathBuf> {
        vec![PathBuf::from("/")]
    }

    pub fn is_hidden(path: &Path) -> bool {
        path.file_name().is_some_and(|name| name.to_string_lossy().starts_with('.'))
    }
}
