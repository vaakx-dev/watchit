export type TimeRange = { start: number; end: number };

export type EngineTrack = { id: number; language: string | null; title: string | null; codec: string | null; channels: number | null };

export type EngineState = {
  paused: boolean;
  time: number;
  duration: number | null;
  buffered: TimeRange[];
  volume: number;
  muted: boolean;
  waiting: boolean;
  ended: boolean;
  error: string | null;
  audio_tracks: EngineTrack[];
  subtitle_tracks: EngineTrack[];
  audio: number | null;
  subtitle: number | null;
};

export type SubtitleFile = { id: number; url: string; language: string | null; title: string | null };

export type Media = { url: string; protocol: 'file' | 'hls'; start: number; subtitles: SubtitleFile[]; subtitle: number | null };

export type Engine = {
  kind: 'mpv' | 'browser';
  load: (media: Media) => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  set_volume: (volume: number) => void;
  set_muted: (muted: boolean) => void;
  select_audio: (id: number) => void;
  select_subtitle: (id: number | null) => void;
  destroy: () => void;
  subscribe: (listener: () => void) => () => void;
  state: () => EngineState;
};

export const INITIAL_STATE: EngineState = {
  paused: true,
  time: 0,
  duration: null,
  buffered: [],
  volume: 100,
  muted: false,
  waiting: true,
  ended: false,
  error: null,
  audio_tracks: [],
  subtitle_tracks: [],
  audio: null,
  subtitle: null,
};
