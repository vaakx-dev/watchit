import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Artwork } from '../../catalog/components/artwork';
import { StatusEye } from '../components/eye';
import { before_of, move, step, type Move } from '../ranking_moves';
import type { RankedItem, Rankings } from '../types';
import { Stars } from './stars';

type Drag = Move & { origin: string | null };

const STEPS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 };

function target(rankings: Rankings, id: string, rows: Map<string, HTMLElement>, y: number): string | null {
  const tier = rankings.tiers.find(candidate => candidate.items.some(item => item.title.id === id));
  for (const item of tier?.items ?? []) {
    const rect = item.title.id === id ? undefined : rows.get(item.title.id)?.getBoundingClientRect();
    if (rect && y < rect.top + rect.height / 2) return item.title.id;
  }
  return null;
}

function rank_of(rankings: Rankings, id: string) {
  return rankings.tiers.flatMap(tier => tier.items).find(item => item.title.id === id)?.rank;
}

export function RankedList({ rankings, reorder }: { rankings: Rankings; reorder: (move: Move) => Promise<void> }) {
  const hint = useId();
  const rows = useRef(new Map<string, HTMLElement>());
  const focus = useRef<string | null>(null);
  const [drag, set_drag] = useState<Drag | null>(null);
  const [announcement, set_announcement] = useState('');
  const shown = drag ? move(rankings, drag) : rankings;

  useLayoutEffect(() => {
    if (!focus.current) return;
    rows.current.get(focus.current)?.querySelector<HTMLButtonElement>('.ranked-handle')?.focus();
    focus.current = null;
  });

  function commit(item: RankedItem, change: Move) {
    void reorder(change);
    set_announcement(`${item.title.title} moved to number ${rank_of(move(rankings, change), item.title.id)}.`);
  }

  function start(item: RankedItem, event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = before_of(rankings, item.title.id);
    set_drag({ id: item.title.id, before: origin, origin });
  }

  function follow(item: RankedItem, event: PointerEvent<HTMLButtonElement>) {
    if (drag?.id !== item.title.id) return;
    const before = target(shown, item.title.id, rows.current, event.clientY);
    if (before !== drag.before) set_drag({ ...drag, before });
  }

  function drop(item: RankedItem) {
    if (drag?.id !== item.title.id) return;
    set_drag(null);
    if (drag.before !== drag.origin) commit(item, { id: drag.id, before: drag.before });
  }

  function nudge(item: RankedItem, event: KeyboardEvent<HTMLButtonElement>) {
    const direction = STEPS[event.key];
    if (!direction) return;
    event.preventDefault();
    const change = step(rankings, item.title.id, direction);
    if (!change) {
      set_announcement(`${item.title.title} is already ${direction === -1 ? 'first' : 'last'} among titles with this rating.`);
      return;
    }
    focus.current = item.title.id;
    commit(item, change);
  }

  return <>
    <p className="ranking-hint" id={hint}>Drag a handle, or focus it and press ↑ or ↓, to reorder titles that share a rating.</p>
    <ol className="ranked-list">
      {shown.tiers.flatMap(tier => tier.items.map(item => <li className="ranked-row" key={item.title.id}
        data-dragging={drag?.id === item.title.id}
        ref={node => {
          if (node) rows.current.set(item.title.id, node);
          return () => { rows.current.delete(item.title.id); };
        }}>
        <span className="ranked-number">{item.rank}</span>
        <a className="ranked-poster" href={`#/title/${item.title.id}`} tabIndex={-1} aria-hidden="true"><Artwork src={item.title.artwork} label={item.title.title} /></a>
        <div className="ranked-copy">
          <h3><a href={`#/title/${item.title.id}`}>{item.title.title}</a></h3>
          <p>
            <Stars value={tier.rating} />
            <StatusEye status={item.entry.status} favorite={item.entry.favorite} recommended={item.entry.recommended} />
            {item.entry.favorite && <span className="sr-only">Favourite</span>}
            {item.entry.recommended && <span className="sr-only">Recommended</span>}
          </p>
        </div>
        <button type="button" className="ranked-handle" disabled={tier.items.length < 2}
          aria-label={`Move ${item.title.title}, number ${item.rank}`} aria-describedby={hint}
          onPointerDown={event => start(item, event)}
          onPointerMove={event => follow(item, event)}
          onPointerUp={() => drop(item)}
          onPointerCancel={() => set_drag(null)}
          onKeyDown={event => nudge(item, event)} />
      </li>))}
    </ol>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </>;
}
