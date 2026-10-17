import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { read_settings, save_settings } from '../../torrents/api';
import { Choices } from '../../ui/choices';

type Mode = 'one' | 'parallel';

const PARALLEL_DEFAULT = 3;
const PARALLEL_MAX = 20;

export function describe(max_active: number) {
  return max_active === 1 ? 'Downloads run one at a time, in this order.' : `Up to ${max_active} downloads at once, in this order.`;
}

export function ParallelControl({ on_change }: { on_change: (max_active: number) => void }) {
  const [max_active, set_max_active] = useState<number | null>(null);
  const [failure, set_failure] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    read_settings(controller.signal).then(settings => {
      set_max_active(settings.max_active);
      on_change(settings.max_active);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [on_change]);

  async function save(next: number) {
    const previous = max_active;
    set_max_active(next);
    on_change(next);
    set_failure('');
    try {
      await save_settings({ ...await read_settings(), max_active: next });
    } catch (cause) {
      set_max_active(previous);
      if (previous !== null) on_change(previous);
      set_failure(cause instanceof Error ? cause.message : 'Could not save.');
    }
  }

  if (max_active === null) return null;
  const mode: Mode = max_active === 1 ? 'one' : 'parallel';
  const options = [{ value: 'one' as const, label: 'One at a time' }, { value: 'parallel' as const, label: 'In parallel' }];

  return <div className="queue-parallel">
    <Choices label="How many download at once" look="segmented" options={options} value={mode}
      on_change={value => { if (value !== mode) void save(value === 'one' ? 1 : PARALLEL_DEFAULT); }} />
    {mode === 'parallel' && <div className="queue-stepper" role="group" aria-label="Downloads at once">
      <button type="button" className="icon-button small ghost" aria-label="Fewer at once" onClick={() => void save(max_active - 1)}><Minus /></button>
      <span aria-live="polite">{max_active} at once</span>
      <button type="button" className="icon-button small ghost" aria-label="More at once" disabled={max_active >= PARALLEL_MAX}
        onClick={() => void save(max_active + 1)}><Plus /></button>
    </div>}
    {failure && <p role="alert" className="transfer-error">{failure}</p>}
  </div>;
}
