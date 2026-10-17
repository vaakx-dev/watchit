type Props = { id?: string; label: string; checked: boolean; disabled?: boolean; on_change: (checked: boolean) => void };

export function Switch({ id, label, checked, disabled, on_change }: Props) {
  return <button type="button" id={id} role="switch" className="setting-switch" aria-label={label} aria-checked={checked} disabled={disabled}
    onClick={() => on_change(!checked)} />;
}
