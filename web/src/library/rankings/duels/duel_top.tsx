import { useLayoutEffect, useRef, useState } from 'react';
import { Artwork } from '../../../catalog/components/artwork';
import type { DuelStanding } from '../../../generated/library/DuelStanding';

const TOP = 5;
const STEP = 66;

function Mini({ standing, place, pop }: { standing: DuelStanding; place: number; pop: boolean }) {
  const node = useRef<HTMLLIElement>(null);
  const [placed, set_placed] = useState(false);
  const shown = place >= 0;

  useLayoutEffect(() => {
    void node.current?.offsetWidth;
    set_placed(true);
  }, []);

  return <li ref={node} className="duel-mini" data-first={place === 0} data-pop={pop} aria-hidden={!shown || undefined}
    style={{ transform: `translateX(${(placed && shown ? place : TOP) * STEP}px)`, opacity: shown ? 1 : 0 }}>
    <Artwork src={standing.title.artwork} label={standing.title.title} />
    <b>{shown ? place + 1 : standing.rank}</b>
  </li>;
}

export function DuelTop({ top, changed }: { top: readonly DuelStanding[]; changed: readonly string[] }) {
  const [known, set_known] = useState<readonly DuelStanding[]>(top);
  const missing = top.filter(standing => !known.some(other => other.title.id === standing.title.id));
  if (missing.length) set_known([...known, ...missing]);

  return <ol className="duel-top" aria-label="Top five">
    {known.map(standing => {
      const place = top.findIndex(other => other.title.id === standing.title.id);
      return <Mini key={standing.title.id} standing={standing} place={place} pop={changed.includes(standing.title.id)} />;
    })}
  </ol>;
}
