import { ArrowDown, ArrowUp, Gauge, MonitorPlay, Turtle } from 'lucide-react';
import { useState } from 'react';
import { speed as rate } from '../../torrents/format';
import type { SpeedMode as Mode, SpeedStatus } from '../../torrents/types';
import { set_alternative } from './api';
import './bandwidth.css';

const MODES: Record<Mode, { icon: typeof Gauge; label: string }> = {
  normal: { icon: Gauge, label: 'Normal speed' },
  alternative: { icon: Turtle, label: 'Alternative speed' },
  watching: { icon: MonitorPlay, label: 'Watching' },
};

function Limits({ speed }: { speed: SpeedStatus }) {
  if (speed.mode === 'watching') {
    return <span>{speed.download_bps_limit ? `Background downloads limited to ${rate(speed.download_bps_limit)}` : 'Background downloads paused'}</span>;
  }
  if (speed.download_bps_limit === null && speed.upload_bps_limit === null) return <span>No speed limit</span>;
  return <span>
    <span><ArrowDown />{speed.download_bps_limit === null ? 'No limit' : rate(speed.download_bps_limit)}</span>
    <span><ArrowUp />{speed.upload_bps_limit === null ? 'No limit' : rate(speed.upload_bps_limit)}</span>
  </span>;
}

export function SpeedMode({ speed }: { speed: SpeedStatus | null }) {
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  if (!speed) return null;
  const { icon: Icon, label } = MODES[speed.mode];

  function toggle(alternative: boolean) {
    set_pending(true);
    set_error(null);
    set_alternative(alternative)
      .catch((cause: unknown) => set_error(cause instanceof Error ? cause.message : 'The server did not respond.'))
      .finally(() => set_pending(false));
  }

  return <div className="speed-mode" data-mode={speed.mode}>
    <p role="status"><Icon /><strong>{label}</strong><Limits speed={speed} /></p>
    {error && <span className="speed-mode-error" role="alert">{error}</span>}
    <button type="button" className="button secondary small speed-turtle" aria-pressed={speed.alternative} disabled={pending}
      onClick={() => toggle(!speed.alternative)}>
      <Turtle />Alternative speed
    </button>
  </div>;
}
