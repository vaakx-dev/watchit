declare module 'webtorrent' {
  import type { EventEmitter } from 'node:events';
  import type { Readable } from 'node:stream';

  export interface TorrentFile {
    readonly name: string;
    readonly path: string;
    readonly length: number;
    readonly downloaded: number;
    readonly progress: number;
    select(priority?: number): void;
    deselect(): void;
    createReadStream(range?: { start?: number; end?: number }): Readable;
  }

  export interface Torrent extends EventEmitter {
    readonly infoHash: string;
    readonly name: string;
    readonly ready: boolean;
    readonly destroyed: boolean;
    readonly files: TorrentFile[];
    readonly downloadSpeed: number;
    readonly numPeers: number;
  }

  export interface AddOptions {
    path?: string;
    announce?: string[];
    deselect?: boolean;
  }

  export default class WebTorrent extends EventEmitter {
    constructor(options?: { maxConns?: number });
    add(torrent_id: string, options?: AddOptions): Torrent;
    destroy(callback?: (error?: Error) => void): void;
  }
}
