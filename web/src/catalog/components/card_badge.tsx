import { StatusEye } from '../../library/components/eye';
import { STATUS_BADGES } from '../../library/status_labels';
import type { PersonalEntry } from '../../library/types';

export function CardBadge({ entry }: { entry: PersonalEntry | undefined }) {
  const status = entry?.status ?? null;
  const favorite = entry?.favorite ?? false;
  if (status === null && !favorite) return null;
  return <span className="card-badge" data-status={status ?? 'favorite'}>
    <StatusEye status={status} favorite={favorite} />{status ? STATUS_BADGES[status] : 'Favourite'}
  </span>;
}
