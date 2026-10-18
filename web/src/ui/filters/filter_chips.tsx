import type { ButtonHTMLAttributes, Ref } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

type Button = ButtonHTMLAttributes<HTMLButtonElement>;

export function MenuChip({ label, set, open, ref, ...button }: Button & { label: string; set: boolean; open: boolean; ref?: Ref<HTMLButtonElement> }) {
  return <button type="button" className="filter-chip" data-set={set || undefined} aria-haspopup="dialog" aria-expanded={open} ref={ref} {...button}>
    {label}<ChevronDown />
  </button>;
}

export function ToggleChip({ label, on, on_change }: { label: string; on: boolean; on_change: (on: boolean) => void }) {
  return <button type="button" className="filter-chip" data-set={on || undefined} aria-pressed={on} onClick={() => on_change(!on)}>
    {label}{on && <Check />}
  </button>;
}

export function ClearableChip({ label, clear_label, on_clear, ref, ...button }: Button & { label: string; clear_label: string; on_clear: () => void; ref?: Ref<HTMLButtonElement> }) {
  return <span className="filter-chip clearable" data-set>
    <button type="button" aria-haspopup="dialog" ref={ref} {...button}>{label}</button>
    <button type="button" aria-label={clear_label} onClick={on_clear}><X /></button>
  </span>;
}
