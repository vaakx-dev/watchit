import type { ReactNode } from 'react';

export type Choice<T extends string> = { value: T; label: string; icon?: ReactNode; count?: number; status?: string };

export function Choices<T extends string>({ label, options, value, on_change, look = 'chips', children }: {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  on_change: (value: T) => void;
  look?: 'chips' | 'segmented' | 'tabs';
  children?: ReactNode;
}) {
  return <div className={`choices ${look}`} role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} data-status={option.status}
      aria-pressed={option.value === value} onClick={() => on_change(option.value)}>
      {option.icon}{option.label}{option.count !== undefined && <small>{option.count}</small>}
    </button>)}
    {children}
  </div>;
}
