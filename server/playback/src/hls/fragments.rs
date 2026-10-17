use std::io::SeekFrom;
use std::path::Path;

use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

const EXTENSION: &str = ".mp4";
const HEADER_BOXES: [&[u8; 4]; 2] = [b"ftyp", b"moov"];

pub fn segment_name(index: usize) -> String {
    format!("{index}{EXTENSION}")
}

pub fn segment_index(name: &str) -> Option<usize> {
    name.strip_suffix(EXTENSION)?.parse().ok()
}

pub fn segment_pattern() -> String {
    format!("%d{EXTENSION}")
}

pub async fn read_init(path: &Path) -> std::io::Result<Vec<u8>> {
    let mut file = File::open(path).await?;
    let length = header_length(&mut file).await?;
    let mut init = vec![0; length as usize];
    file.seek(SeekFrom::Start(0)).await?;
    file.read_exact(&mut init).await?;
    Ok(init)
}

pub async fn open_media(path: &Path) -> std::io::Result<(File, u64)> {
    let mut file = File::open(path).await?;
    let total = file.metadata().await?.len();
    let start = header_length(&mut file).await?;
    file.seek(SeekFrom::Start(start)).await?;
    Ok((file, total - start))
}

async fn header_length(file: &mut File) -> std::io::Result<u64> {
    let mut offset = 0;
    loop {
        file.seek(SeekFrom::Start(offset)).await?;
        let mut header = [0; 16];
        file.read_exact(&mut header[..8]).await?;
        let kind = &header[4..8];
        if !HEADER_BOXES.iter().any(|name| name.as_slice() == kind) {
            return Ok(offset);
        }
        let size = match u32::from_be_bytes([header[0], header[1], header[2], header[3]]) {
            1 => {
                file.read_exact(&mut header[8..16]).await?;
                u64::from_be_bytes(header[8..16].try_into().expect("eight bytes"))
            }
            size => u64::from(size),
        };
        if size < 8 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Malformed MP4 box."));
        }
        offset += size;
    }
}
