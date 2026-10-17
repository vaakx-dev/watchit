import type Hls from 'hls.js';
import { create_state_store } from './state_store';
import type { Engine, EngineTrack, Media, SubtitleFile, TimeRange } from './types';
import { remember_volume, saved_volume } from './volume_memory';

function ranges(video: HTMLVideoElement): TimeRange[] {
  return Array.from({ length: video.buffered.length }, (_, index) => ({ start: video.buffered.start(index), end: video.buffered.end(index) }));
}

function subtitle_track(file: SubtitleFile): EngineTrack {
  return { id: file.id, language: file.language, title: file.title, codec: null, channels: null };
}

export function create_browser_engine(video: HTMLVideoElement): Engine {
  const store = create_state_store();
  let hls: Hls | null = null;
  let loading = 0;
  video.volume = saved_volume() / 100;

  const sync = () => store.update({
    paused: video.paused,
    time: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : null,
    buffered: ranges(video),
    volume: Math.round(video.volume * 100),
    muted: video.muted,
    ended: video.ended,
  });
  const events = ['play', 'pause', 'timeupdate', 'durationchange', 'progress', 'volumechange', 'ended', 'seeked', 'loadedmetadata'];
  for (const name of events) video.addEventListener(name, sync);
  video.addEventListener('waiting', () => store.update({ waiting: true }));
  video.addEventListener('playing', () => store.update({ waiting: false }));
  video.addEventListener('canplay', () => store.update({ waiting: false }));
  video.addEventListener('seeking', () => store.update({ waiting: true, time: video.currentTime }));
  video.addEventListener('error', () => store.update({ error: video.error?.message || 'This video could not be played.', waiting: false }));

  function show_subtitle(id: number | null) {
    for (const track of Array.from(video.textTracks)) track.mode = track.id === String(id) ? 'showing' : 'disabled';
    store.update({ subtitle: id });
  }

  function attach_subtitles(files: SubtitleFile[], selected: number | null) {
    for (const element of Array.from(video.querySelectorAll('track'))) element.remove();
    for (const file of files) {
      const element = document.createElement('track');
      element.kind = 'subtitles';
      element.id = String(file.id);
      element.src = file.url;
      element.label = file.title ?? file.language ?? `Track ${file.id}`;
      if (file.language) element.srclang = file.language;
      video.append(element);
    }
    store.update({ subtitle_tracks: files.map(subtitle_track) });
    show_subtitle(selected);
  }

  function release() {
    hls?.destroy();
    hls = null;
    video.removeAttribute('src');
    video.load();
  }

  async function attach(media: Media, attempt: number) {
    if (media.protocol === 'file' || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = media.url;
      return;
    }
    const { default: Player } = await import('hls.js');
    if (attempt !== loading) return;
    hls = new Player({ startPosition: media.start });
    hls.on(Player.Events.ERROR, (_, data) => { if (data.fatal) store.update({ error: data.details, waiting: false }); });
    hls.loadSource(media.url);
    hls.attachMedia(video);
  }

  return {
    kind: 'browser',
    load(media) {
      const attempt = ++loading;
      release();
      store.reset('volume', 'muted');
      store.update({ volume: Math.round(video.volume * 100), muted: video.muted });
      video.addEventListener('loadedmetadata', () => {
        if (attempt !== loading) return;
        if (media.start > 0 && media.protocol === 'file') video.currentTime = media.start;
        attach_subtitles(media.subtitles, media.subtitle);
      }, { once: true });
      void attach(media, attempt).then(() => {
        if (attempt === loading) void video.play().catch(() => sync());
      });
    },
    play: () => { void video.play().catch(() => sync()); },
    pause: () => video.pause(),
    seek: seconds => { video.currentTime = Math.max(0, seconds); },
    set_volume: volume => {
      video.volume = Math.min(Math.max(volume, 0), 100) / 100;
      video.muted = volume <= 0;
      remember_volume(volume);
    },
    set_muted: muted => { video.muted = muted; },
    select_audio: () => undefined,
    select_subtitle: show_subtitle,
    destroy: () => {
      loading++;
      release();
    },
    subscribe: store.subscribe,
    state: store.state,
  };
}
