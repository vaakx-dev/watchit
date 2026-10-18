import { Pause, Play } from 'lucide-react';
import { percent } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { resumable, toggle_pause } from '../menu/control_actions';
import type { Run } from '../row/download_row';

export function ProgressRing({ transfer, name, run }: { transfer: Transfer; name: string; run: Run }) {
  const resume = resumable(transfer);
  const label = `${resume ? 'Resume' : 'Pause'} ${name}, ${percent(transfer.progress)} downloaded`;
  return <button type="button" className="progress-ring" data-paused={resume || undefined} aria-label={label} title={resume ? 'Resume' : 'Pause'}
    onClick={() => run(() => toggle_pause(transfer))}>
    <svg className="progress-ring-dial" viewBox="0 0 34 34" aria-hidden="true">
      <circle className="progress-ring-track" cx="17" cy="17" r="15.5" />
      <circle className="progress-ring-fill" cx="17" cy="17" r="15.5" pathLength="100" strokeDasharray={`${transfer.progress * 100} 100`} />
    </svg>
    {resume ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
  </button>;
}
