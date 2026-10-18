import { useId, useRef, useState, type MouseEvent } from 'react';
import { Check } from 'lucide-react';
import { ClearableChip, MenuChip } from '../../ui/filters/filter_chips';
import { Sheet } from '../../ui/sheet/sheet';
import type { GenreOption } from '../../catalog/types';
import { genre_color } from './genre_colors';

function ordered(genres: readonly GenreOption[]) {
  return [...genres.filter(genre => !genre.minor), ...genres.filter(genre => genre.minor)];
}

export function genre_label(genres: readonly GenreOption[], id: string) {
  return genres.find(genre => genre.id === id)?.label ?? id;
}

export function GenreMenu({ genres, value, on_change }: { genres: readonly GenreOption[]; value: string; on_change: (genre: string) => void }) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);

  function choose(genre: string) {
    set_open(false);
    on_change(genre);
  }

  const chip = { popoverTarget: id, 'aria-controls': id, 'aria-expanded': open, ref: anchor, disabled: genres.length === 0 && !value,
    onClick: (event: MouseEvent) => { event.preventDefault(); set_open(!open); } };

  return <>
    {value ? <ClearableChip label={genre_label(genres, value)} clear_label="Clear genre" on_clear={() => choose('')} {...chip} />
      : <MenuChip label="Genre" set={false} open={open} {...chip} />}
    <Sheet id={id} title="Genre" open={open} anchor={anchor} on_close={() => set_open(false)} className="genre-sheet"
      action={<button type="button" className="sheet-action" disabled={!value} onClick={() => choose('')}>Clear</button>}>
      <div className="genre-tiles" role="group" aria-label="Genres">
        {ordered(genres).map(genre => <button type="button" key={genre.id} className="genre-tile" style={{ backgroundColor: genre_color(genre.id) }}
          aria-pressed={genre.id === value} onClick={() => choose(genre.id === value ? '' : genre.id)}>
          {genre.label}{genre.id === value && <Check />}
        </button>)}
      </div>
    </Sheet>
  </>;
}
