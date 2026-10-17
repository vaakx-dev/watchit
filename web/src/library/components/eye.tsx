import { Eye, type Pupil } from '../../ui/eye';
import type { Status } from '../types';

const PUPILS: Record<Status, Pupil | undefined> = {
  want: 'want',
  watching: 'watching',
  paused: 'paused',
  watched: 'watched',
  dropped: undefined,
};

export function StatusEye({ status, favorite = false, recommended = false }: {
  status: Status | null;
  favorite?: boolean;
  recommended?: boolean;
}) {
  return <span className="status-eye" data-status={status ?? 'none'} data-favorite={favorite} data-recommended={recommended}>
    <Eye dropped={status === 'dropped'} recommended={recommended} pupil={favorite ? 'heart' : status === null ? undefined : PUPILS[status]} />
  </span>;
}
