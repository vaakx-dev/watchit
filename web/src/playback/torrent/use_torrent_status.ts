import { useEffect, useState } from 'react';
import { request } from '../../catalog/client';
import { result_key, torrent_url } from './api';
import type { TorrentResult, TorrentStatus } from './types';

const POLL_MS = 2000;

export function use_torrent_status(result: TorrentResult | null) {
  const [reading, set_reading] = useState<{ key: string; status: TorrentStatus } | null>(null);
  const key = result ? result_key(result) : null;

  useEffect(() => {
    if (!result || !key) return;
    const controller = new AbortController();
    let timer = 0;
    const poll = () => {
      request<TorrentStatus>(torrent_url(result, 'status'), { signal: controller.signal })
        .then(status => set_reading({ key, status }))
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) timer = window.setTimeout(poll, POLL_MS);
        });
    };
    poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key]);

  return reading?.key === key ? reading.status : null;
}
