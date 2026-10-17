import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import type { TorrentFile } from 'webtorrent';
import { HttpError } from '../http.ts';

const TYPES: Record<string, string> = {
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.ogv': 'video/ogg',
  '.3gp': 'video/3gpp',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
};

type Range = { start: number; end: number };

function byte_range(header: string | undefined, length: number): Range | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const range = match[1]
    ? { start: Number(match[1]), end: match[2] ? Math.min(Number(match[2]), length - 1) : length - 1 }
    : { start: Math.max(0, length - Number(match[2])), end: length - 1 };
  if (range.start >= length || range.start > range.end) {
    throw new HttpError(416, 'Requested range is not satisfiable.');
  }
  return range;
}

export function send_file(req: IncomingMessage, res: ServerResponse, file: TorrentFile, responses: Set<ServerResponse>) {
  res.setHeader('Content-Range', `bytes */${file.length}`);
  const range = byte_range(req.headers.range, file.length);
  res.removeHeader('Content-Range');
  const { start, end } = range ?? { start: 0, end: file.length - 1 };
  res.statusCode = range ? 206 : 200;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', TYPES[extname(file.name).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Content-Length', end - start + 1);
  res.setHeader('Cache-Control', 'no-store');
  if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
  if (req.method === 'HEAD' || file.length === 0) {
    res.end();
    return;
  }
  const stream = file.createReadStream({ start, end: Math.max(end, 1) });
  let remaining = end - start + 1;
  responses.add(res);
  const finish = () => {
    responses.delete(res);
    stream.destroy();
  };
  stream.on('data', (chunk: Buffer) => {
    const piece = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    remaining -= piece.length;
    if (!res.write(piece)) stream.pause();
    if (remaining <= 0) {
      finish();
      res.end();
    }
  });
  res.on('drain', () => stream.resume());
  stream.on('end', () => { finish(); res.end(); });
  stream.on('error', () => { finish(); res.destroy(); });
  res.on('close', finish);
}
