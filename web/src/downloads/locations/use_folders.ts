import { useEffect, useState } from 'react';
import type { FolderListing } from '../../torrents/types';
import { list_folders } from './api';

type Browse = { listing: FolderListing | null; error: string | null; loading: boolean };

export function use_folders(path: string | null) {
  const [state, set_state] = useState<Browse & { path: string | null }>({ path, listing: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    set_state(current => ({ ...current, path, loading: true, error: null }));
    list_folders(path, controller.signal)
      .then(listing => set_state({ path, listing, error: null, loading: false }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        set_state(current => ({ ...current, path, loading: false, error: cause instanceof Error ? cause.message : 'The server did not respond.' }));
      });
    return () => controller.abort();
  }, [path]);

  return state;
}
