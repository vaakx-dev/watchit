use std::io::Cursor;

use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageReader};
use watchit_core::{AppError, AppResult};

const SIZE: u32 = 256;
const QUALITY: f32 = 80.0;
const MAX_PIXELS: u64 = 40_000_000;

fn decode(upload: &[u8]) -> Option<DynamicImage> {
    let mut decoder = ImageReader::new(Cursor::new(upload)).with_guessed_format().ok()?.into_decoder().ok()?;
    let (width, height) = decoder.dimensions();
    if u64::from(width) * u64::from(height) > MAX_PIXELS {
        return None;
    }
    let orientation = decoder.orientation().ok()?;
    let mut image = DynamicImage::from_decoder(decoder).ok()?;
    image.apply_orientation(orientation);
    Some(image)
}

fn encode(image: &DynamicImage) -> Vec<u8> {
    let square = image.resize_to_fill(SIZE, SIZE, FilterType::Lanczos3);
    let encoded = if square.color().has_alpha() {
        webp::Encoder::from_rgba(&square.to_rgba8(), SIZE, SIZE).encode(QUALITY)
    } else {
        webp::Encoder::from_rgb(&square.to_rgb8(), SIZE, SIZE).encode(QUALITY)
    };
    encoded.to_vec()
}

pub fn avatar_webp(upload: &[u8]) -> AppResult<Vec<u8>> {
    let image = decode(upload).ok_or_else(|| AppError::bad_request("That file is not an image Watchit can read."))?;
    Ok(encode(&image))
}
