import type { CSSProperties } from 'react';
import { Icon } from '../../ui/icon';

function icon(volume: number, muted: boolean) {
  if (muted || volume <= 0) return 'volume-off';
  return volume < 50 ? 'volume-low' : 'volume';
}

export function Volume({ volume, muted, on_volume, on_mute }: { volume: number; muted: boolean; on_volume: (volume: number) => void; on_mute: (muted: boolean) => void }) {
  const level = muted ? 0 : volume;
  return <div className="volume">
    <button type="button" className="player-button" aria-label={muted ? 'Unmute' : 'Mute'} title={`${muted ? 'Unmute' : 'Mute'} (M)`} onClick={() => on_mute(!muted)}>
      <Icon name={icon(volume, muted)} />
    </button>
    <input type="range" className="volume-slider" min={0} max={100} step={1} value={level} aria-label="Volume"
      style={{ '--level': `${level}%` } as CSSProperties} onChange={event => on_volume(Number(event.target.value))} />
  </div>;
}
