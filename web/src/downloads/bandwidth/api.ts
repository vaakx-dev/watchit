import { send } from '../../catalog/client';
import { update_speed } from '../../torrents/transfer_store';
import type { SpeedStatus } from '../../torrents/types';

export async function set_alternative(alternative: boolean) {
  update_speed(await send<SpeedStatus>('/api/transfers/speed', 'PATCH', { alternative }));
}
