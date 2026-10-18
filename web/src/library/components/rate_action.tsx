import { useId, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import type { CatalogEntry } from '../../catalog/types';
import { Sheet } from '../../ui/sheet/sheet';
import { Stars } from './stars';
import type { Library } from '../use_library';
import { TitleRating } from './title_rating';

export function RateAction({ title, library }: { title: CatalogEntry; library: Library }) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);
  const rating = library.entries[title.id]?.rating ?? null;

  return <>
    <button type="button" className="title-action" ref={anchor} disabled={!library.ready} popoverTarget={id} aria-controls={id} aria-expanded={open}
      aria-label={rating === null ? `Rate ${title.title}` : `Your rating for ${title.title}: ${rating} out of 5. Change rating`}
      onClick={event => { event.preventDefault(); set_open(!open); }}>
      {rating === null ? <Star /> : <Stars value={rating} />}
      <span>{rating === null ? 'Rate' : 'Your rating'}</span>
    </button>
    <Sheet id={id} title={`Rate ${title.title}`} open={open} anchor={anchor} on_close={() => set_open(false)} className="rate-sheet"
      action={rating !== null && <button type="button" className="sheet-action" onClick={() => { void library.update(title.id, { rating: null }); }}>Clear</button>}>
      <TitleRating title={title} library={library} />
    </Sheet>
  </>;
}
