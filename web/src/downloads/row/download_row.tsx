import { useRef, useState, type ReactNode } from 'react';
import { Ellipsis, Trash2, Replace } from 'lucide-react';
import type { Transfer } from '../../torrents/types';
import { ActionMenu, type MenuAction, type MenuAnchor, type MenuHeading } from '../menu/action_menu';
import { control_actions } from '../menu/control_actions';
import { DeleteDialog, type Deletion } from '../menu/delete_dialog';
import { ReplaceSource } from '../menu/replace_source';
import { use_long_press } from '../menu/use_long_press';
import { ProgressBar } from './progress_bar';

export type RowMenu = { heading: MenuHeading; controls: Transfer | null; replace: Transfer | null; deletion: Deletion };
export type Reorder = { handle: ReactNode; dragging: boolean };
export type Run = (work: () => Promise<unknown>) => void;

type Props = {
  lead: ReactNode;
  name: ReactNode;
  sub: ReactNode;
  meta?: ReactNode;
  progress?: Transfer;
  trailing: (run: Run) => ReactNode;
  menu: RowMenu;
  reorder?: Reorder;
};

export function DownloadRow({ lead, name, sub, meta, progress, trailing, menu, reorder }: Props) {
  const more = useRef<HTMLButtonElement>(null);
  const [anchor, set_anchor] = useState<MenuAnchor | null>(null);
  const [dialog, set_dialog] = useState<'delete' | 'replace' | null>(null);
  const [failure, set_failure] = useState<string | null>(null);
  const press = use_long_press(({ x, y }) => set_anchor({ top: y, bottom: y, right: x }));

  const run: Run = work => {
    set_failure(null);
    work().catch((cause: unknown) => set_failure(cause instanceof Error ? cause.message : 'The server did not respond.'));
  };

  const actions: MenuAction[] = [
    ...menu.controls ? control_actions(menu.controls, run) : [],
    ...menu.replace ? [{ label: 'Choose another source', icon: Replace, run: () => set_dialog('replace') }] : [],
    { label: 'Delete download', icon: Trash2, danger: true, run: () => set_dialog('delete') },
  ];

  function open_from_button() {
    const box = more.current?.getBoundingClientRect();
    if (box) set_anchor({ top: box.top, bottom: box.bottom, right: box.right });
  }

  return <li className="download-item" data-queue-row data-dragging={reorder?.dragging || undefined}>
    <div className="download-row" {...reorder ? {} : press}>
      {lead}
      <div className="download-body">
        <p className="download-name">{name}</p>
        {failure ? <p className="download-sub" role="alert"><span data-tone="failed">{failure}</span></p> : sub}
        {progress && <ProgressBar transfer={progress} />}
      </div>
      <div className="download-meta">{meta}</div>
      <div className="download-actions">
        {reorder ? reorder.handle : <>
          {trailing(run)}
          <button type="button" ref={more} className="icon-button small ghost download-more" aria-haspopup="menu" aria-expanded={anchor !== null}
            aria-label={`More for ${menu.heading.name}`} title="More" onClick={open_from_button}><Ellipsis /></button>
        </>}
      </div>
    </div>
    {anchor && <ActionMenu heading={menu.heading} actions={actions} anchor={anchor} on_close={() => set_anchor(null)} />}
    {dialog === 'delete' && <DeleteDialog deletion={menu.deletion} on_close={() => set_dialog(null)} />}
    {dialog === 'replace' && menu.replace && <ReplaceSource transfer={menu.replace} heading={menu.heading.name} on_close={() => set_dialog(null)} />}
  </li>;
}
