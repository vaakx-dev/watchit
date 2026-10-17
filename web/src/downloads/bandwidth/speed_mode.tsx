import { Gauge, MonitorPlay, Turtle } from 'lucide-react';
import { useState } from 'react';
import { speed as rate } from '../../torrents/format';
import type { SpeedMode as Mode, SpeedStatus } from '../../torrents/types';
import { set_alternative } from './api';
import './bandwidth.css';

const ICONS: Record<Mode, typeof Gauge> = { normal: Gauge, alternative: Turtle, watching: MonitorPlay };

function describe(speed: SpeedStatus) {
  const limit = speed.download_bps_limit;
  if (speed.mode === 'watching') return limit ? `Watching · background limited to ${rate(limit)}` : 'Watching · background paused';
  const name = speed.mode === 'alternative' ? 'Alternative speed' : 'Normal speed';
  return limit === null ? name : `${name} · ${rate(limit)} limit`;
}

export function SpeedMode({ speed }: { speed: SpeedStatus }) {
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const Icon = ICONS[speed.mode];
  const label = speed.alternative ? 'Turn off alternative speed' : 'Turn on alternative speed';

  function toggle() {
    set_pending(true);
    set_error(null);
    set_alternative(!speed.alternative)
      .catch((cause: unknown) => set_error(cause instanceof Error ? cause.message : 'The server did not respond.'))
      .finally(() => set_pending(false));
  }

  return <span className="speed-mode" data-mode={speed.mode}>
    <Icon />{describe(speed)}
    <button type="button" className="icon-button small ghost speed-turtle" aria-pressed={speed.alternative} aria-label={label} title={label}
      disabled={pending} onClick={toggle}>
      <Turtle />
    </button>
    {error && <span className="speed-mode-error" role="alert">{error}</span>}
  </span>;
}
