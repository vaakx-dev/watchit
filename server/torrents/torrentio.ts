import { HttpError } from '../http.ts';
import type { SearchKind, TorrentResult } from './types.ts';

const ADDON = 'https://torrentio.strem.fun';
const UNITS: Record<string, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

type Stream = {
  name?: unknown;
  title?: unknown;
  infoHash?: unknown;
  fileIdx?: unknown;
  behaviorHints?: { filename?: unknown };
  sources?: unknown;
};

export type Found = { result: TorrentResult; trackers: string[] };

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function seeders(title: string): number | null {
  const match = /👤\s*(\d+)/u.exec(title);
  return match?.[1] ? Number(match[1]) : null;
}

function size_bytes(title: string): number | null {
  const match = /💾\s*([\d.]+)\s*(KB|MB|GB|TB)/u.exec(title);
  if (!match?.[1] || !match[2]) return null;
  return Math.round(Number(match[1]) * (UNITS[match[2]] ?? 1));
}

function quality(name: string): string | null {
  const label = name.split('\n').slice(1).join(' ').trim();
  return label || null;
}

function trackers(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  return sources.filter((source): source is string => typeof source === 'string' && source.startsWith('tracker:'))
    .map(source => source.slice('tracker:'.length));
}

function parse(stream: Stream): Found | null {
  const info_hash = text(stream.infoHash).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(info_hash)) return null;
  const title = text(stream.title);
  const lines = title.split('\n');
  const file = typeof stream.fileIdx === 'number' && Number.isInteger(stream.fileIdx) && stream.fileIdx >= 0 ? String(stream.fileIdx) : 'main';
  const filename = text(stream.behaviorHints?.filename) || null;
  return {
    result: {
      info_hash,
      file,
      name: lines[0]?.trim() || info_hash,
      title,
      filename,
      quality: quality(text(stream.name)),
      size_bytes: size_bytes(title),
      seeders: seeders(title),
    },
    trackers: trackers(stream.sources),
  };
}

export function stream_path(kind: SearchKind, id: string): string {
  return `${ADDON}/stream/${kind}/${encodeURIComponent(id).replaceAll('%3A', ':')}.json`;
}

export async function torrentio_search(kind: SearchKind, id: string): Promise<Found[]> {
  let response: Response;
  try { response = await fetch(stream_path(kind, id), { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } }); }
  catch { throw new HttpError(502, 'Torrent search is unavailable.'); }
  if (!response.ok) throw new HttpError(502, `Torrent search failed with HTTP ${response.status}.`);
  const body = await response.json() as { streams?: unknown };
  const streams = Array.isArray(body.streams) ? body.streams as Stream[] : [];
  return streams.map(parse).filter((found): found is Found => found !== null);
}
