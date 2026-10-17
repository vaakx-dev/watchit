import { request, send } from '../catalog/client';
import type { TorrentSettings, Transfer, TransferKind, TransferList } from './types';

const id_path = (id: string) => encodeURIComponent(id);

export const search_url = (title_id: string) => `/api/torrents/search?title=${id_path(title_id)}`;

export const local_files_url = (title_id: string) => `/api/titles/${id_path(title_id)}/files`;

export function list_transfers(signal?: AbortSignal) {
  return request<TransferList>('/api/transfers', { signal });
}

export function add_transfer(info_hash: string, file_indexes: number[] | null, title_id: string, kind: TransferKind) {
  return send<Transfer>('/api/transfers', 'POST', { info_hash, file_indexes, title_id, kind });
}

export function add_season(series_id: string, season: number) {
  return send<Transfer[]>('/api/transfers/season', 'POST', { series_id, season });
}

export function update_transfer(id: string, patch: { paused?: boolean; kind?: 'download' }) {
  return send<unknown>(`/api/transfers/${id_path(id)}`, 'PATCH', patch);
}

export function delete_transfer(id: string, delete_files: boolean) {
  return send<unknown>(`/api/transfers/${id_path(id)}?delete_files=${delete_files}`, 'DELETE');
}

export function read_settings(signal?: AbortSignal) {
  return request<TorrentSettings>('/api/torrents/settings', { signal });
}

export function save_settings(settings: TorrentSettings) {
  return send<TorrentSettings>('/api/torrents/settings', 'PATCH', settings);
}
