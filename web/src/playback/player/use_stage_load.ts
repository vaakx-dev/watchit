import { useEffect, useRef } from 'react';
import type { Engine, SubtitleFile } from '../engine/types';
import type { PlaybackSession } from '../session/types';

function subtitle_files(session: PlaybackSession): SubtitleFile[] {
  return session.subtitle_tracks.flatMap(track => track.url ? [{ id: track.index, url: track.url, language: track.language, title: track.title }] : []);
}

export function use_stage_load(engine: Engine | null, session: PlaybackSession | null, start: number, subtitle: number | null) {
  const choice = useRef(subtitle);
  choice.current = subtitle;

  useEffect(() => {
    if (!engine || !session) return;
    engine.load({ url: session.url, protocol: session.protocol, start, subtitles: subtitle_files(session), subtitle: choice.current });
  }, [engine, session]);
}
