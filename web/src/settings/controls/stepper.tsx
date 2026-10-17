import { Minus, Plus } from 'lucide-react';

type Props = { label: string; value: number; min: number; max: number; on_change: (value: number) => void };

export function Stepper({ label, value, min, max, on_change }: Props) {
  return <span className="setting-stepper" role="group" aria-label={label}>
    <button type="button" className="icon-button small ghost" aria-label="Fewer" disabled={value <= min} onClick={() => on_change(value - 1)}><Minus /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" className="icon-button small ghost" aria-label="More" disabled={value >= max} onClick={() => on_change(value + 1)}><Plus /></button>
  </span>;
}
