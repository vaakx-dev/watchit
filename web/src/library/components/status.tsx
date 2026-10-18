import { useImperativeHandle, type Ref } from 'react';
import type { CatalogEntry } from '../../catalog/types';
import { STATUS_LABELS } from '../status_labels';
import type { Status } from '../types';
import type { Library } from '../use_library';
import { StatusEye } from './eye';
import { use_status_menu } from './use_status_menu';

export type StatusMenuHandle = { open: () => void };

function trigger_text(status: Status | null, favorite: boolean) {
  if (status) return STATUS_LABELS[status];
  return favorite ? 'Favourite' : 'Status';
}

export function StatusControls({ title, library, labelled = false, ref }: { title: CatalogEntry; library: Library; labelled?: boolean; ref?: Ref<StatusMenuHandle> }) {
  const { status, favorite, recommended, label, trigger_props, panel, show } = use_status_menu(title, library);
  useImperativeHandle(ref, () => ({ open: show }));

  return <div className="status-controls">
    <button type="button" className={`status-trigger${labelled ? ' labelled' : ''}`} {...trigger_props}
      data-status={favorite && status === null ? 'favorite' : status ?? undefined}
      aria-label={`${title.title}: ${label}. Change status`} title={label}>
      <StatusEye status={status} favorite={favorite} recommended={recommended} />{labelled && <>
        <span>{trigger_text(status, favorite)}</span>
      </>}</button>
    {panel}
  </div>;
}
