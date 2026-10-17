import { Volume1, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { PlayerButton } from './player_button';

function VolumeIcon({ level }: { level: number }) {
  if (level <= 0) return <VolumeX />;
  return level < 50 ? <Volume1 /> : <Volume2 />;
}

export function Volume({ volume, muted, on_volume, on_mute }: { volume: number; muted: boolean; on_volume: (volume: number) => void; on_mute: (muted: boolean) => void }) {
  const level = muted ? 0 : volume;
  return <div className="volume">
    <PlayerButton label={muted ? 'Unmute' : 'Mute'} shortcut="m" on_click={() => on_mute(!muted)}><VolumeIcon level={level} /></PlayerButton>
    <div className="volume-panel">
      <input type="range" className="volume-slider" min={0} max={100} step={1} value={level} aria-label="Volume"
        style={{ '--level': `${level}%` } as CSSProperties} onChange={event => on_volume(Number(event.target.value))} />
    </div>
  </div>;
}
