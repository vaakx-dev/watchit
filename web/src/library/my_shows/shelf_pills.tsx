import { useEffect, useRef } from 'react';
import { Bookmark, History } from 'lucide-react';
import { Choices, type Choice } from '../../ui/choices';
import { mine_route } from '../../navigation/route';
import { StatusEye } from '../components/eye';
import type { LibraryPage, Shelf } from '../types';
import { EXTRA_SHELVES, SHELF_LABELS, SHELF_ORDER } from './shelves';

function shelf_icon(shelf: Shelf) {
  if (shelf === 'favorite') return <StatusEye status={null} favorite />;
  if (shelf === 'recommended') return <StatusEye status={null} recommended />;
  if (shelf === 'saved') return <Bookmark />;
  if (shelf === 'recent') return <History />;
  return <StatusEye status={shelf} />;
}

export function ShelfPills({ shelf, counts }: { shelf: Shelf; counts: LibraryPage['counts'] | undefined }) {
  const shown = SHELF_ORDER.filter(value => value === shelf || !EXTRA_SHELVES.includes(value) || (counts?.[value] ?? 0) > 0);
  const options: Choice<Shelf>[] = shown.map(value => ({
    value, label: SHELF_LABELS[value], icon: shelf_icon(value), count: counts?.[value],
    status: EXTRA_SHELVES.includes(value) ? undefined : value,
  }));

  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [shelf]);

  return <div className="myshows-pills" ref={row}>
    <Choices look="pills" label="Watch status" options={options} value={shelf}
      on_change={next => { window.location.hash = mine_route(next); }} />
  </div>;
}
