import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const FORMATS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'heif',
};
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const MAX_PIXELS = 40_000_000;
const QUALITY = 78;

sharp.cache(false);
sharp.concurrency(1);

export async function encode_image(input: string, output: string, content_type: string): Promise<{ bytes: number; content_type: string }> {
  const source = await readFile(input);
  const image = sharp(source, { limitInputPixels: MAX_PIXELS });
  if ((await image.metadata()).format !== FORMATS[content_type]) throw new Error('Image body does not match its raster content type');
  const encoded = await image.autoOrient()
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY }).toBuffer();
  const result = content_type === 'image/webp' && encoded.length >= source.length ? source : encoded;
  await writeFile(output, result);
  return { bytes: result.length, content_type: 'image/webp' };
}
