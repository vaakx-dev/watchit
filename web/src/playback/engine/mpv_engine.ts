import { mpv_listen, mpv_send, type MpvValue } from './mpv_bridge';
import { create_state_store } from './state_store';
import type { Engine, EngineTrack, TimeRange } from './types';
import { remember_volume, saved_volume } from './volume_memory';

const OBSERVED = ['pause', 'time-pos', 'duration', 'volume', 'mute', 'track-list', 'aid', 'sid', 'paused-for-cache', 'seeking', 'eof-reached', 'demuxer-cache-state'];

type MpvTrack = { id: number; type: string; lang?: string; title?: string; codec?: string; 'demux-channel-count'?: number };

const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

function tracks(list: unknown, type: string): EngineTrack[] {
  if (!Array.isArray(list)) return [];
  return (list as MpvTrack[]).filter(track => track.type === type).map(track => ({
    id: track.id,
    language: track.lang ?? null,
    title: track.title ?? null,
    codec: track.codec ?? null,
    channels: track['demux-channel-count'] ?? null,
  }));
}

function seekable(cache: unknown): TimeRange[] {
  const list = cache && typeof cache === 'object' && 'seekable-ranges' in cache ? cache['seekable-ranges'] : null;
  return Array.isArray(list) ? list.filter(range => number(range?.start) !== null && number(range?.end) !== null) : [];
}

const set = (name: string, value: MpvValue) => mpv_send(['mpv-set-prop', [name, value]]);

export function create_mpv_engine(): Engine {
  const store = create_state_store();
  const flags = { cache: false, seeking: false };
  const waiting = () => flags.cache || flags.seeking;

  function change(name: string, data: unknown) {
    if (name === 'pause') store.update({ paused: data === true });
    if (name === 'time-pos') store.update({ time: number(data) ?? 0 });
    if (name === 'duration') store.update({ duration: number(data) });
    if (name === 'volume') store.update({ volume: number(data) ?? 100 });
    if (name === 'mute') store.update({ muted: data === true });
    if (name === 'track-list') store.update({ audio_tracks: tracks(data, 'audio'), subtitle_tracks: tracks(data, 'sub') });
    if (name === 'aid') store.update({ audio: number(data) });
    if (name === 'sid') store.update({ subtitle: number(data) });
    if (name === 'eof-reached') store.update({ ended: data === true });
    if (name === 'demuxer-cache-state') store.update({ buffered: seekable(data) });
    if (name === 'paused-for-cache') flags.cache = data === true;
    if (name === 'seeking') flags.seeking = data === true;
    if (name === 'paused-for-cache' || name === 'seeking') store.update({ waiting: waiting() });
  }

  const unlisten = mpv_listen(([kind, payload]) => {
    if (kind === 'mpv-prop-change') change(payload.name, payload.data);
    if (kind === 'mpv-event-ended') store.update(payload.reason === 'error' ? { error: 'mpv could not play this file.', waiting: false } : { ended: payload.reason === 'eof' });
  });
  for (const name of OBSERVED) mpv_send(['mpv-observe-prop', name]);
  set('volume', saved_volume());

  return {
    kind: 'mpv',
    load(media) {
      store.reset('volume', 'muted', 'paused');
      set('start', media.start > 0 ? String(media.start) : 'none');
      set('pause', false);
      mpv_send(['mpv-command', ['loadfile', new URL(media.url, window.location.href).href]]);
    },
    play: () => set('pause', false),
    pause: () => set('pause', true),
    seek: seconds => set('time-pos', Math.max(0, seconds)),
    set_volume: volume => {
      set('volume', Math.min(Math.max(volume, 0), 100));
      set('mute', volume <= 0);
      remember_volume(volume);
    },
    set_muted: muted => set('mute', muted),
    select_audio: id => set('aid', id),
    select_subtitle: id => set('sid', id === null ? 'no' : id),
    destroy: () => {
      mpv_send(['mpv-command', ['stop']]);
      unlisten();
    },
    subscribe: store.subscribe,
    state: store.state,
  };
}
