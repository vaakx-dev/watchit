import { useState } from 'react';
import type { Engine, EngineState } from '../engine/types';
import type { PlaybackSession, SessionTracks } from '../session/types';
import { track_option, type TrackOption } from './tracks';

export type TrackMenu = { options: TrackOption[]; selected: number | null; select: (id: number | null) => void };

type Session = { session: PlaybackSession | null; tracks: SessionTracks; restart: (at: number, tracks: SessionTracks) => void };

function mpv_menus(engine: Engine, state: EngineState): { audio: TrackMenu; subtitles: TrackMenu } {
  return {
    audio: { options: state.audio_tracks.map((track, index) => track_option(track.id, track, index)), selected: state.audio, select: id => { if (id !== null) engine.select_audio(id); } },
    subtitles: { options: state.subtitle_tracks.map((track, index) => track_option(track.id, track, index)), selected: state.subtitle, select: engine.select_subtitle },
  };
}

export function use_tracks(engine: Engine | null, state: EngineState, { session, tracks, restart }: Session) {
  const [text_subtitle, set_text_subtitle] = useState<number | null>(null);
  if (engine?.kind === 'mpv') return { ...mpv_menus(engine, state), text_subtitle: null };

  const audio_tracks = session?.audio_tracks ?? [];
  const subtitle_tracks = session?.subtitle_tracks ?? [];
  const burned = tracks.subtitle_track ?? null;

  function select_subtitle(id: number | null) {
    const track = subtitle_tracks.find(item => item.index === id);
    if (track && !track.url) {
      set_text_subtitle(null);
      restart(state.time, { subtitle_track: track.index });
      return;
    }
    set_text_subtitle(id);
    if (burned !== null) restart(state.time, { subtitle_track: null });
    else engine?.select_subtitle(id);
  }

  return {
    audio: {
      options: audio_tracks.map((track, index) => track_option(track.index, track, index)),
      selected: tracks.audio_track ?? audio_tracks.find(track => track.default)?.index ?? audio_tracks[0]?.index ?? null,
      select: (id: number | null) => { if (id !== null && id !== tracks.audio_track) restart(state.time, { audio_track: id }); },
    },
    subtitles: {
      options: subtitle_tracks.map((track, index) => track_option(track.index, { ...track, channels: null }, index)),
      selected: burned ?? state.subtitle,
      select: select_subtitle,
    },
    text_subtitle,
  };
}
