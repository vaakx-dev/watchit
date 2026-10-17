import { use_transfers } from '../../torrents/transfer_store';
import { ReadinessNote } from './readiness_note';

export function RunningNote({ info_hash }: { info_hash: string }) {
  const { transfers } = use_transfers();
  const transfer = transfers.find(item => item.info_hash === info_hash);
  return transfer ? <ReadinessNote transfer={transfer} /> : null;
}
