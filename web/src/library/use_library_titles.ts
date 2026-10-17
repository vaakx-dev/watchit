import { use_resource } from '../catalog/api';
import type { LibraryPage, LibraryQuery } from './types';
import type { Library } from './use_library';
import { use_library_refresh } from './use_library_refresh';

export function use_library_titles({ shelf, kind, sort, page }: LibraryQuery, library: Library) {
  const params = new URLSearchParams({ status: shelf, kind, sort, page: String(page) });
  const result = use_resource<LibraryPage>(`/api/library/titles?${params}`);
  use_library_refresh(library, result.retry);
  return result;
}
