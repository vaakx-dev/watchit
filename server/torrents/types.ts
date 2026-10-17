export type TorrentResult = {
  info_hash: string;
  file: string;
  name: string;
  title: string;
  filename: string | null;
  quality: string | null;
  size_bytes: number | null;
  seeders: number | null;
};

export type TorrentStatus = {
  name: string | null;
  length: number | null;
  downloaded: number;
  progress: number;
  download_speed: number;
  peers: number;
  ready: boolean;
};

export type SearchKind = 'movie' | 'series';
