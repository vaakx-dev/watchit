import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { FolderPicker } from '../../downloads/locations/folder_picker';
import { use_admin } from '../../downloads/locations/use_admin';
import { SettingRow } from '../controls/setting_row';

export function FolderSetting({ folder, on_save }: { folder: string; on_save: (folder: string) => void }) {
  const admin = use_admin();
  const [picking, set_picking] = useState(false);
  const hint = admin ? 'Movies and shows are sorted into their own folders inside it.' : 'Only an admin can change this.';
  return <SettingRow label="Download folder" hint={hint} wide>
    <div className="setting-folder">
      <code title={folder}>{folder}</code>
      {admin && <button type="button" className="button secondary small" onClick={() => set_picking(true)}><FolderOpen />Change</button>}
    </div>
    {picking && <FolderPicker title="Download folder" confirm="Use this folder" start={folder} on_pick={on_save} on_close={() => set_picking(false)} />}
  </SettingRow>;
}
