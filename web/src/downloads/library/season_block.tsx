import { ChevronRight, Package, Trash2 } from 'lucide-react';
import { season_label } from '../../catalog/episodes';
import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { watch_href } from '../titles';
import type { SeasonShelf } from './library_groups';
import { LibraryRow } from './library_row';

export function SeasonBlock({ shelf, open, on_remove }: { shelf: SeasonShelf; open: boolean; on_remove: (transfer: Transfer) => void }) {
  const count = shelf.episodes.length;
  return <details className="library-season" open={open}>
    <summary>
      <ChevronRight />
      <span>{season_label(shelf.season)}</span>
      <span className="meta"><span>{count === 1 ? '1 episode' : `${count} episodes`}</span><span>{bytes(shelf.size)}</span></span>
    </summary>
    {shelf.packs.map(pack => <p key={pack.id} className="library-pack">
      <Package />
      <span title={pack.name}>Season pack: {pack.name}</span>
      <button type="button" className="icon-button small ghost" aria-label={`Delete ${pack.name}`} title="Delete pack" onClick={() => on_remove(pack)}>
        <Trash2 />
      </button>
    </p>)}
    <ul className="library-rows">
      {shelf.episodes.map(copy => <LibraryRow key={`${copy.transfer.id}:${copy.id}`} label={`E${copy.episode}`} name={copy.name} size={copy.size}
        href={watch_href(copy.id)} on_remove={copy.pack ? undefined : () => on_remove(copy.transfer)} />)}
    </ul>
  </details>;
}
