type Props = { label: string; value: number | null; unit?: string; on_change: (value: number | null) => void };

export function RangeField({ label, value, unit, on_change }: Props) {
  return <label className="range-field">
    <span>{label}</span>
    <input type="number" inputMode="decimal" min={0} step="any" value={value ?? ''} placeholder="Any"
      onChange={event => {
        const parsed = Number.parseFloat(event.target.value);
        on_change(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
      }} />
    {unit && <small>{unit}</small>}
  </label>;
}
