import { Pause, Play } from 'lucide-react';

export function Bezel({ paused }: { paused: boolean }) {
  return <div className="bezel" aria-hidden="true">{paused ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</div>;
}
