import { Check, X } from 'lucide-react';
import { STATUS_LABELS } from '../status_labels';
import { STATUSES, type Status } from '../types';
import { StatusEye } from './eye';
import { use_drag_dismiss } from '../../ui/sheet/use_drag_dismiss';

function SheetHeader({ title, on_close }: { title: string; on_close: () => void }) {
  const drag = use_drag_dismiss(on_close);

  return <div className="status-sheet-header">
    <div className="status-sheet-grab" {...drag}>
      <span className="status-sheet-handle" aria-hidden="true" />
      <h2>{title}</h2>
    </div>
    <button type="button" className="icon-button ghost" aria-label="Close" onClick={on_close}><X /></button>
  </div>;
}

export function StatusMenu({ title, status, favorite, recommended, disabled, on_status, on_favorite, on_recommended, on_close }: {
  title: string;
  status: Status | null;
  favorite: boolean;
  recommended: boolean;
  disabled: boolean;
  on_status: (status: Status | null) => void;
  on_favorite: () => void;
  on_recommended: () => void;
  on_close: () => void;
}) {
  return <>
    <SheetHeader title={title} on_close={on_close} />
    <div className="status-options" role="group" aria-label="Watch status">
      {STATUSES.map(option => <button type="button" key={option} className="status-option" data-status={option} disabled={disabled}
        aria-pressed={status === option} onClick={() => on_status(status === option ? null : option)}>
        <StatusEye status={option} /><span>{STATUS_LABELS[option]}</span><Check className="status-check" />
      </button>)}
    </div>
    <button type="button" role="switch" className="flag-switch" data-flag="favorite" disabled={disabled} aria-checked={favorite} onClick={on_favorite}>
      <StatusEye status={status} favorite /><span>Favourite</span><span className="switch" aria-hidden="true" />
    </button>
    <button type="button" role="switch" className="flag-switch" data-flag="recommended" data-status={status ?? undefined} disabled={disabled}
      aria-checked={recommended} onClick={on_recommended}>
      <StatusEye status={status} recommended /><span>Recommended</span><span className="switch" aria-hidden="true" />
    </button>
  </>;
}
