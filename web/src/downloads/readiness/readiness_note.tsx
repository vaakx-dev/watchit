import { CirclePlay, Hourglass } from 'lucide-react';
import type { Transfer } from '../../torrents/types';
import { readiness_text } from './readiness_text';
import './readiness.css';

export function shows_readiness(transfer: Transfer) {
  const { state } = transfer.readiness;
  if (transfer.state === 'seeding' || transfer.state === 'completed' || transfer.state === 'error') return false;
  return state === 'ready' || state === 'waiting';
}

export function ReadinessNote({ transfer }: { transfer: Transfer }) {
  const text = readiness_text(transfer.readiness);
  if (!text || !shows_readiness(transfer)) return null;
  const ready = transfer.readiness.state === 'ready';
  return <span className="readiness" data-ready={ready} role="status">
    {ready ? <CirclePlay aria-hidden="true" /> : <Hourglass aria-hidden="true" />}
    {text}
  </span>;
}
