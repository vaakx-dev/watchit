import { useCallback, useEffect, useRef, useState } from 'react';
import { error_message } from '../../catalog/client';
import { read_settings, save_settings } from '../../torrents/api';
import type { TorrentSettings } from '../../torrents/types';
import { use_saving } from '../controls/use_saving';

export function use_torrent_settings() {
  const [settings, set_settings] = useState<TorrentSettings | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);
  const current = useRef<TorrentSettings | null>(null);
  const { saving, track } = use_saving();

  useEffect(() => {
    const controller = new AbortController();
    set_error(null);
    read_settings(controller.signal)
      .then(loaded => { current.current = loaded; set_settings(loaded); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) set_error(error_message(cause)); });
    return () => controller.abort();
  }, [attempt]);

  const save = useCallback((patch: Partial<TorrentSettings>) => {
    const previous = current.current;
    if (!previous) return;
    const next = { ...previous, ...patch };
    current.current = next;
    set_settings(next);
    track(save_settings(next))
      .then(saved => { if (current.current === next) { current.current = saved; set_settings(saved); } })
      .catch(() => { if (current.current === next) { current.current = previous; set_settings(previous); } });
  }, [track]);

  return { settings, error, retry: () => set_attempt(value => value + 1), saving, save };
}
