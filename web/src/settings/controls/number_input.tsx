import { useEffect, useState, type KeyboardEvent } from 'react';
import { SettingRow } from './setting_row';

export type NumberSpec = {
  id: string;
  label: string;
  hint: string;
  unit: string;
  scale?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  empty?: string;
};

function shown(value: number | null, scale: number) {
  return value === null ? '' : String(Number((value / scale).toFixed(2)));
}

function parse(text: string, spec: NumberSpec): { value: number | null } | { error: string } {
  if (text.trim() === '') return spec.empty ? { value: null } : { error: 'Enter a number.' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: 'Enter a number.' };
  if (spec.integer && !Number.isInteger(value)) return { error: 'Enter a whole number.' };
  const min = spec.min ?? 0;
  if (value < min || (spec.max !== undefined && value > spec.max)) {
    return { error: spec.max === undefined ? `Use ${min} or more.` : `Use ${min} to ${spec.max}.` };
  }
  const scale = spec.scale ?? 1;
  return { value: scale === 1 ? value : Math.round(value * scale) };
}

export function NumberInput({ spec, value, disabled, on_save }: { spec: NumberSpec; value: number | null; disabled?: boolean; on_save: (value: number | null) => void }) {
  const scale = spec.scale ?? 1;
  const [text, set_text] = useState(() => shown(value, scale));
  const [error, set_error] = useState('');
  useEffect(() => { set_text(shown(value, scale)); set_error(''); }, [value, scale]);

  function commit() {
    const result = parse(text, spec);
    if ('error' in result) return set_error(result.error);
    set_error('');
    if (result.value !== value) on_save(result.value);
  }

  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') { set_text(shown(value, scale)); set_error(''); }
  }

  return <SettingRow id={spec.id} label={spec.label} hint={spec.hint} error={error}>
    <span className="setting-number">
      <input id={spec.id} inputMode="decimal" value={text} placeholder={spec.empty} disabled={disabled}
        aria-invalid={error ? true : undefined} aria-describedby={`${spec.id}-hint`}
        onChange={event => set_text(event.target.value)} onBlur={commit} onKeyDown={key} />
      <span>{spec.unit}</span>
    </span>
  </SettingRow>;
}
