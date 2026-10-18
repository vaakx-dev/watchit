import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Equal, RotateCw, Swords, Undo2 } from 'lucide-react';
import { Artwork } from '../../../catalog/components/artwork';
import { CatalogStatus } from '../../../catalog/components/status';
import { error_message } from '../../../catalog/client';
import type { CatalogKind } from '../../../catalog/types';
import { EmptyState } from '../../../ui/empty_state';
import { DuelTop } from './duel_top';
import * as motion from './motion';
import { use_duels, type DuelBoard } from './use_duels';
import './duels.css';

type Side = 0 | 1;
type Burst = { side: Side; gain: number; key: number };

const SIDES: readonly Side[] = [0, 1];
const SETTLE_MS = 260;
const POP_MS = 700;

export function DuelScreen({ kind }: { kind: CatalogKind }) {
  const duels = use_duels(kind);
  const [board, set_board] = useState<DuelBoard | null>(null);
  const [round, set_round] = useState(0);
  const [changed, set_changed] = useState<readonly string[]>([]);
  const [named, set_named] = useState(true);
  const [burst, set_burst] = useState<Burst | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const busy = useRef(true);
  const cards = useRef<(HTMLButtonElement | null)[]>([null, null]);

  if (!board && duels.resource.status === 'ready') set_board(duels.resource.data);

  useLayoutEffect(() => {
    if (!board) return;
    SIDES.forEach(side => void motion.deal(cards.current[side], side));
    const timer = setTimeout(() => { busy.current = false; }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [board]);

  useEffect(() => {
    if (!changed.length) return;
    const timer = setTimeout(() => set_changed([]), POP_MS);
    return () => clearTimeout(timer);
  }, [changed]);

  if (!board) return <CatalogStatus error={duels.resource.status === 'error' ? duels.resource.error : undefined} retry={duels.retry} message="Loading duels." />;
  const pair = board.pair;
  if (pair.length < 2) return <EmptyState icon={Swords} title="Mark two titles Watched to duel" />;
  const current = board;

  async function act(move: () => Promise<unknown>, request: () => Promise<DuelBoard>, moved: readonly string[], hide = true) {
    if (busy.current) return;
    busy.current = true;
    if (hide) set_named(false);
    const [next] = await Promise.all([
      request().then(next => { set_error(null); return next; }, (cause: unknown) => { set_error(error_message(cause)); return null; }),
      move(),
    ]);
    set_board(next ?? { ...current });
    set_changed(next ? moved : []);
    set_round(value => value + 1);
    set_named(true);
  }

  function pick(side: Side) {
    if (busy.current) return;
    set_burst({ side, gain: pair[side]!.gain, key: round });
    void act(() => motion.win(cards.current, side), () => duels.result(pair, pair[side]!.title.id), [pair[side]!.title.id]);
  }

  const tie = () => void act(() => motion.tie(cards.current), () => duels.result(pair, null), pair.map(contender => contender.title.id));
  const skip = () => void act(() => motion.skip(cards.current), () => duels.skip(pair), []);
  const undo = () => void act(() => Promise.resolve(), duels.undo, [], false);

  return <div className="duel">
    <div className="duel-stage">
      {SIDES.map(side => <div className="duel-slot" data-side={side} key={side}>
        <span className="duel-deck" data-depth="2" />
        <span className="duel-deck" data-depth="1" />
        <button type="button" className="duel-card" key={round} aria-label={pair[side]!.title.title}
          ref={node => { cards.current[side] = node; }} onClick={() => pick(side)}>
          <Artwork src={pair[side]!.title.artwork} label={pair[side]!.title.title} eager />
        </button>
      </div>)}
      {SIDES.map(side => <p className="duel-name" data-side={side} data-hidden={!named} key={side}>{pair[side]!.title.title}</p>)}
      {burst && <span className="duel-burst" data-side={burst.side} key={burst.key} aria-hidden="true">+{burst.gain}</span>}
      <div className="duel-actions">
        <button type="button" title="Undo" aria-label="Undo" disabled={!board.can_undo} onClick={undo}><Undo2 /></button>
        <button type="button" title="Tie" aria-label="Tie" onClick={tie}><Equal /></button>
        <button type="button" title="Skip" aria-label="Skip" onClick={skip}><RotateCw /></button>
      </div>
    </div>
    {error && <p className="ranking-error" role="alert">{error}</p>}
    <DuelTop top={board.top} changed={changed} />
  </div>;
}
