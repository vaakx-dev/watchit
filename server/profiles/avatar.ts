import type { IncomingMessage, ServerResponse } from 'node:http';
import sharp from 'sharp';
import { HttpError, read_body } from '../http.ts';
import type { AvatarImage } from '../storage/types.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const SIZE = 256;
const QUALITY = 80;

export async function read_avatar(req: IncomingMessage): Promise<Buffer> {
  if (!req.headers['content-type']?.startsWith('image/')) throw new HttpError(415, 'Upload an image file.');
  const body = await read_body(req, MAX_BYTES);
  try {
    return await sharp(body, { limitInputPixels: MAX_PIXELS }).autoOrient()
      .resize(SIZE, SIZE, { fit: 'cover' }).webp({ quality: QUALITY }).toBuffer();
  } catch {
    throw new HttpError(400, 'That file is not an image Watchit can read.');
  }
}

export function send_avatar(req: IncomingMessage, res: ServerResponse, url: URL, avatar: AvatarImage | null) {
  if (!avatar) throw new HttpError(404, 'This profile has no photo.');
  const etag = `"${avatar.updated_at}"`;
  const versioned = url.searchParams.get('v') === String(avatar.updated_at);
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', versioned ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('ETag', etag);
  res.statusCode = req.headers['if-none-match'] === etag ? 304 : 200;
  res.end(res.statusCode === 304 ? undefined : avatar.image);
}
