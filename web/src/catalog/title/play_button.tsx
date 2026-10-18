import { Play } from 'lucide-react';
import { ProgressBar } from '../components/progress_bar';
import type { SavedPosition } from '../types';

export function PlayButton({ href, label, resume }: { href: string; label: string; resume: SavedPosition | null }) {
  return <div className="title-play">
    <a className="button primary wide" href={href}><Play fill="currentColor" />{label}</a>
    {resume && <ProgressBar resume={resume} />}
  </div>;
}
