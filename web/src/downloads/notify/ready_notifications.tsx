import { onAction } from '@tauri-apps/plugin-notification';
import { useEffect } from 'react';
import { desktop } from '../../playback/engine/mpv_bridge';
import { on_ready_event, use_transfers } from '../../torrents/transfer_store';
import { open_player, show_ready } from './display';

export function ReadyNotifications() {
  use_transfers();

  useEffect(() => on_ready_event(event => { void show_ready(event); }), []);

  useEffect(() => {
    if (!desktop) return;
    const listening = onAction(({ notification }) => {
      const title_id = notification?.extra?.title_id;
      if (typeof title_id === 'string') open_player(title_id);
    });
    return () => { void listening.then(listener => listener.unregister()); };
  }, []);

  return null;
}
