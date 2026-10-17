import { Play, Trash2 } from 'lucide-react';
import { bytes } from '../../torrents/format';

export function LibraryRow({ label, name, size, href, on_remove }: {
  label: string | null;
  name: string;
  size: number;
  href: string;
  on_remove?: () => void;
}) {
  return <li className="library-row">
    <a className="icon-button small" href={href} aria-label={`Play ${label ?? name}`} title="Play"><Play fill="currentColor" /></a>
    <a className="library-row-copy" href={href}>
      {label && <strong>{label}</strong>}
      <span title={name}>{name}</span>
    </a>
    <span className="library-row-size">{bytes(size)}</span>
    {on_remove && <button type="button" className="icon-button small ghost" aria-label={`Delete ${name}`} title="Delete" onClick={on_remove}>
      <Trash2 />
    </button>}
  </li>;
}
