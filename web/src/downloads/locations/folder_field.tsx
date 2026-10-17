import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { FolderPicker } from './folder_picker';

type Props = { id: string; label: string; hint: string; value: string; placeholder?: string; invalid?: string; admin: boolean; on_change: (value: string) => void };

export function FolderField({ id, label, hint, value, placeholder, invalid, admin, on_change }: Props) {
  const [picking, set_picking] = useState(false);
  return <div className="cache-field folder-field">
    <label htmlFor={id}>{label}</label>
    <div className="cache-input">
      <input id={id} value={value} placeholder={placeholder} spellCheck={false} readOnly={!admin} aria-describedby={`${id}-hint`}
        aria-invalid={invalid ? true : undefined} onChange={event => on_change(event.target.value)} />
      {admin && <button type="button" className="icon-button small ghost" aria-label={`Browse for ${label.toLowerCase()}`} title="Browse" onClick={() => set_picking(true)}>
        <FolderOpen />
      </button>}
    </div>
    <p id={`${id}-hint`} className={invalid ? 'cache-hint invalid' : 'cache-hint'}>{invalid || (admin ? hint : 'Only an admin can change this.')}</p>
    {picking && <FolderPicker title={label} confirm="Use this folder" start={value.trim() || null} on_pick={on_change} on_close={() => set_picking(false)} />}
  </div>;
}
