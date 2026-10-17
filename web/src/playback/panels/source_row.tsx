import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { resolution_label } from '../../torrents/quality';

type Props = {
  resolution: string | null;
  hdr: readonly string[];
  name: string;
  details: (string | null | false)[];
  current: boolean;
  on_play: () => void;
  action?: ReactNode;
};

export function SourceRow({ resolution, hdr, name, details, current, on_play, action }: Props) {
  const quality = resolution_label(resolution);
  const meta = details.filter(Boolean);
  return <li className="source-row">
    <button type="button" className="source-play" aria-current={current || undefined} onClick={on_play}>
      <span className="source-quality">
        <strong>{quality ?? 'Unknown'}</strong>
        {hdr.map(format => <span key={format} className="source-hdr">{format}</span>)}
      </span>
      <span className="source-copy">
        <span className="source-name">{name}</span>
        {meta.length > 0 && <span className="meta">{meta.map(item => <span key={String(item)}>{item}</span>)}</span>}
      </span>
      <Play className="source-state" fill="currentColor" />
    </button>
    {action}
  </li>;
}
