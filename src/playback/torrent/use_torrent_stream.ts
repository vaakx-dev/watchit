import { useEffect, useState } from 'react';
import { request } from '../../catalog/client';
import { result_key, torrent_url } from './api';
import type { TorrentResult, TorrentStream } from './types';

type Opened = { key: string; stream: TorrentStream | null; failure: string | null };

export function use_torrent_stream(result: TorrentResult | null) {
  const [opened, set_opened] = useState<Opened | null>(null);
  const key = result ? result_key(result) : null;

  useEffect(() => {
    if (!result || !key) return;
    const controller = new AbortController();
    request<TorrentStream>(torrent_url(result, 'play'), { signal: controller.signal })
      .then(stream => set_opened({ key, stream, failure: null }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        set_opened({ key, stream: null, failure: cause instanceof Error ? cause.message : 'The server did not respond.' });
      });
    return () => controller.abort();
  }, [key]);

  return opened?.key === key ? opened : null;
}
