export type Resolution = '2160p' | '1080p' | '720p' | '480p';
export type HdrFormat = 'DV' | 'HDR10+' | 'HDR10' | 'HLG';

export type TorrentResult = {
  info_hash: string;
  file_index: number | null;
  name: string;
  filename: string | null;
  resolution: Resolution | null;
  hdr: HdrFormat[];
  video_codec: string | null;
  audio: string | null;
  size_bytes: number | null;
  seeders: number | null;
  site: string | null;
  languages: string[];
};

export type TransferKind = 'stream' | 'download';
export type TransferState = 'metadata' | 'queued' | 'downloading' | 'paused' | 'seeding' | 'completed' | 'error';

export type TransferFile = { index: number; name: string; size_bytes: number; progress: number; title_id: string | null };

export type Transfer = {
  id: string;
  info_hash: string;
  name: string;
  title_id: string;
  kind: TransferKind;
  state: TransferState;
  error: string | null;
  files: TransferFile[];
  size_bytes: number;
  downloaded_bytes: number;
  progress: number;
  download_bps: number;
  upload_bps: number;
  peers: number;
  eta_seconds: number | null;
  added_at: number;
};

export type Disk = { used_bytes: number; budget_bytes: number | null; free_bytes: number };

export type TransferList = { transfers: Transfer[]; disk: Disk };

export type TorrentSettings = {
  download_dir: string;
  disk_budget_bytes: number | null;
  max_download_bps: number | null;
  max_upload_bps: number | null;
  seed_ratio: number | null;
  seed_minutes: number | null;
  max_active: number;
};

export type LocalFile = {
  info_hash: string;
  file_index: number;
  name: string;
  size_bytes: number;
  progress: number;
  resolution: string | null;
  hdr: string[];
};
