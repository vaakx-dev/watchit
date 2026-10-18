use std::io::Cursor;

use fast_image_resize::images::Image;
use fast_image_resize::{IntoImageView, Resizer};
use image::{DynamicImage, GenericImageView, ImageDecoder, ImageFormat, ImageReader, metadata::Orientation};

use crate::download::Downloaded;
use crate::failure::ImageFailure;

const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;
const MAX_PIXELS: u64 = 40_000_000;
const QUALITY: f32 = 78.0;

fn mismatch() -> ImageFailure {
    ImageFailure::rejected("Image body does not match its raster content type")
}

fn decode(bytes: &[u8], format: ImageFormat) -> Result<DynamicImage, ImageFailure> {
    let reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format().map_err(|_| mismatch())?;
    if reader.format() != Some(format) {
        return Err(mismatch());
    }
    let mut decoder = reader.into_decoder().map_err(|_| mismatch())?;
    let (width, height) = decoder.dimensions();
    if u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(ImageFailure::rejected("Image exceeds the pixel limit"));
    }
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut image = DynamicImage::from_decoder(decoder).map_err(|error| ImageFailure::rejected(format!("Image could not be decoded: {error}")))?;
    image.apply_orientation(orientation);
    Ok(if image.color().has_alpha() {
        DynamicImage::ImageRgba8(image.into_rgba8())
    } else {
        DynamicImage::ImageRgb8(image.into_rgb8())
    })
}

fn fitted(width: u32, height: u32) -> (u32, u32) {
    let scale = (f64::from(MAX_WIDTH) / f64::from(width)).min(f64::from(MAX_HEIGHT) / f64::from(height));
    if scale >= 1.0 {
        return (width, height);
    }
    let scaled = |side: u32| ((f64::from(side) * scale).round() as u32).max(1);
    (scaled(width), scaled(height))
}

fn resize(image: &DynamicImage) -> Result<(Vec<u8>, u32, u32), ImageFailure> {
    let (width, height) = image.dimensions();
    let (target_width, target_height) = fitted(width, height);
    if (target_width, target_height) == (width, height) {
        return Ok((image.as_bytes().to_vec(), width, height));
    }
    let pixel_type = image
        .pixel_type()
        .ok_or_else(|| ImageFailure::rejected("Unsupported image pixel layout"))?;
    let mut target = Image::new(target_width, target_height, pixel_type);
    Resizer::new()
        .resize(image, &mut target, None)
        .map_err(|error| ImageFailure::rejected(format!("Image could not be resized: {error}")))?;
    Ok((target.into_vec(), target_width, target_height))
}

pub(crate) fn encode(downloaded: &Downloaded) -> Result<Vec<u8>, ImageFailure> {
    let image = decode(&downloaded.bytes, downloaded.format)?;
    let (pixels, width, height) = resize(&image)?;
    let encoder = if image.color().has_alpha() {
        webp::Encoder::from_rgba(&pixels, width, height)
    } else {
        webp::Encoder::from_rgb(&pixels, width, height)
    };
    let encoded = encoder.encode(QUALITY).to_vec();
    if downloaded.format == ImageFormat::WebP && encoded.len() >= downloaded.bytes.len() {
        return Ok(downloaded.bytes.clone());
    }
    Ok(encoded)
}
