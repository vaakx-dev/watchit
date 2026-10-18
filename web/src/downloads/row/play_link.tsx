import { Play } from 'lucide-react';

export function PlayLink({ href, name }: { href: string; name: string }) {
  return <a className="download-play" href={href} aria-label={`Play ${name}`} title="Play"><Play fill="currentColor" /></a>;
}
