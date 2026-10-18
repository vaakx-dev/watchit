import type { CatalogEntry } from '../../catalog/types';
import { ChevronDown } from 'lucide-react';
import { STATUS_LABELS } from '../status_labels';
import type { Status } from '../types';
import type { Library } from '../use_library';
import { StatusEye } from './eye';
import { use_status_menu } from './use_status_menu';

function trigger_text(status: Status | null, favorite: boolean) {
  if (status) return STATUS_LABELS[status];
  return favorite ? 'Favourite' : 'Add status';
}

export function StatusControls({ title, library, labelled = false }: { title: CatalogEntry; library: Library; labelled?: boolean }) {
  const { status, favorite, recommended, label, trigger_props, panel } = use_status_menu(title, library);

  return <div className="status-controls">
    <button type="button" className={`status-trigger${labelled ? ' labelled' : ''}`} {...trigger_props}
      data-status={favorite && status === null ? 'favorite' : status ?? undefined}
      aria-label={`${title.title}: ${label}. Change status`} title={label}>
      <StatusEye status={status} favorite={favorite} recommended={recommended} />{labelled && <>
        <span>{trigger_text(status, favorite)}</span><ChevronDown />
      </>}</button>
    {panel}
  </div>;
}
