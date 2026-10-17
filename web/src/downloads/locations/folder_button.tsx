import { useState } from 'react';
import { FolderInput } from 'lucide-react';
import { use_default_folder } from './default_folder';
import { FolderPicker } from './folder_picker';
import { use_admin } from './use_admin';

type Props = {
  label: string;
  confirm: string;
  series?: boolean;
  start?: string;
  disabled?: boolean;
  on_pick: (path: string) => void;
};

function Picker({ label, confirm, series = false, start, on_pick, on_close }: Props & { on_close: () => void }) {
  const fallback = use_default_folder(series);
  if (start === undefined && fallback === undefined) return null;
  return <FolderPicker title={label} confirm={confirm} start={start ?? fallback ?? null} on_pick={on_pick} on_close={on_close} />;
}

export function FolderButton(props: Props) {
  const admin = use_admin();
  const [open, set_open] = useState(false);
  if (!admin) return null;
  return <>
    <button type="button" className="icon-button small ghost folder-button" aria-label={props.label} title={props.label}
      disabled={props.disabled} onClick={() => set_open(true)}><FolderInput /></button>
    {open && <Picker {...props} on_close={() => set_open(false)} />}
  </>;
}
