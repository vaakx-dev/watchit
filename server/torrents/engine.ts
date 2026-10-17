import { join } from 'node:path';
import WebTorrent, { type Torrent, type TorrentFile } from 'webtorrent';
import { HttpError } from '../http.ts';
import type { TorrentStatus } from './types.ts';

const VIDEO = /\.(mkv|mp4|m4v|avi|mov|wmv|webm|ts|m2ts|mpg|mpeg|flv|ogv|3gp|vob|divx|rmvb)$/i;
const METADATA_TIMEOUT = 90_000;
const FALLBACK_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://explodie.org:6969/announce',
];

export type Engine = ReturnType<typeof create_engine>;

function largest(files: readonly TorrentFile[]): TorrentFile | undefined {
  return files.reduce<TorrentFile | undefined>((best, file) => !best || file.length > best.length ? file : best, undefined);
}

function chosen_file(torrent: Torrent, file: string): TorrentFile {
  const selected = file === 'main'
    ? largest(torrent.files.filter(item => VIDEO.test(item.name))) ?? largest(torrent.files)
    : torrent.files[Number(file)];
  if (!selected) throw new HttpError(404, 'File not found in torrent.');
  return selected;
}

export function create_engine(directory: string) {
  const client = new WebTorrent({ maxConns: 80 });
  const torrents = new Map<string, Torrent>();
  const trackers = new Map<string, string[]>();
  const selected_files = new WeakSet<TorrentFile>();
  const closing = new AbortController();
  client.on('error', (error: unknown) => console.error('[torrents]', error));

  function remember(info_hash: string, announce: string[]) {
    if (announce.length) trackers.set(info_hash, announce);
  }

  function start(info_hash: string): Torrent {
    if (closing.signal.aborted) throw new HttpError(503, 'Torrent engine is closed.');
    const running = torrents.get(info_hash);
    if (running && !running.destroyed) return running;
    const torrent = client.add(info_hash, {
      path: join(directory, 'torrents'),
      announce: trackers.get(info_hash) ?? FALLBACK_TRACKERS,
      deselect: true,
    });
    torrent.on('error', (error: unknown) => {
      console.error('[torrents]', info_hash, error);
      torrents.delete(info_hash);
    });
    torrents.set(info_hash, torrent);
    return torrent;
  }

  function select(torrent: Torrent, file: string): TorrentFile {
    const selected = chosen_file(torrent, file);
    if (!selected_files.has(selected)) {
      selected_files.add(selected);
      selected.select();
    }
    return selected;
  }

  async function file(info_hash: string, file: string): Promise<TorrentFile> {
    const torrent = start(info_hash);
    if (!torrent.ready) {
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer);
          torrent.off('ready', on_ready);
          torrent.off('error', on_error);
          closing.signal.removeEventListener('abort', on_abort);
          if (error) reject(error); else resolve();
        };
        const on_ready = () => finish();
        const on_error = () => finish(new HttpError(502, 'Torrent failed to start.'));
        const on_abort = () => finish(new HttpError(503, 'Torrent engine is closed.'));
        const timer = setTimeout(() => finish(new HttpError(504, 'Torrent metadata did not arrive in time.')), METADATA_TIMEOUT);
        torrent.once('ready', on_ready);
        torrent.once('error', on_error);
        closing.signal.addEventListener('abort', on_abort);
      });
    }
    return select(torrent, file);
  }

  function status(info_hash: string, file: string): TorrentStatus {
    const torrent = start(info_hash);
    const selected = torrent.ready ? select(torrent, file) : null;
    return {
      name: selected?.name ?? null,
      length: selected?.length ?? null,
      downloaded: selected?.downloaded ?? 0,
      progress: selected?.progress ?? 0,
      download_speed: torrent.downloadSpeed,
      peers: torrent.numPeers,
      ready: torrent.ready,
    };
  }

  function close(): Promise<void> {
    closing.abort();
    torrents.clear();
    return new Promise(resolve => client.destroy(() => resolve()));
  }

  return { remember, file, status, close };
}
