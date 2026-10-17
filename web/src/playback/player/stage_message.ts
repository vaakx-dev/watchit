import type { EngineState } from '../engine/types';
import type { PlaybackSession } from '../session/types';

type Progress = { has_file: boolean; session: PlaybackSession | null; state: EngineState };

export function stage_message({ has_file, session, state }: Progress) {
  if (!has_file) return 'Starting the torrent…';
  if (!session) return 'Preparing playback…';
  if (state.waiting) return 'Loading…';
  return null;
}
