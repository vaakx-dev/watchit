import { sendNotification } from '@tauri-apps/plugin-notification';
import { request } from '../../catalog/client';
import type { TitleResult } from '../../catalog/types';
import type { ReadyEvent } from '../../torrents/types';
import { desktop } from '../../playback/engine/mpv_bridge';
import { notify_permission } from './permission';

const HEADING = 'Ready to watch';

function watch_hash(title_id: string) {
  return `#/watch/${title_id}`;
}

export function open_player(title_id: string) {
  window.location.hash = watch_hash(title_id);
}

function already_watching(title_id: string) {
  return document.hasFocus() && window.location.hash === watch_hash(title_id);
}

async function readable_name(event: ReadyEvent) {
  const [series_id, season, episode] = event.title_id.split(':');
  try {
    const { title } = await request<TitleResult>(`/api/titles/${encodeURIComponent(series_id ?? event.title_id)}`);
    return season && episode ? `${title.title} S${season} E${episode}` : title.title;
  } catch {
    return event.name;
  }
}

function show_in_browser(body: string, title_id: string) {
  const notification = new Notification(HEADING, { body, tag: `ready:${title_id}` });
  notification.onclick = () => {
    window.focus();
    open_player(title_id);
    notification.close();
  };
}

export async function show_ready(event: ReadyEvent) {
  if (already_watching(event.title_id) || (await notify_permission()) !== 'granted') return;
  const body = `${await readable_name(event)} can start playing now.`;
  if (desktop) sendNotification({ title: HEADING, body, extra: { title_id: event.title_id } });
  else show_in_browser(body, event.title_id);
}
