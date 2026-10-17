import { request } from '../../catalog/client';
import type { FolderListing } from '../../torrents/types';

export function list_folders(path: string | null, signal?: AbortSignal) {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return request<FolderListing>(`/api/folders${query}`, { signal });
}
