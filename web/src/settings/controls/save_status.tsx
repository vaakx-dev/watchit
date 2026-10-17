import { Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { Saving } from './use_saving';

export function SaveStatus({ saving }: { saving: Saving }) {
  if (saving.state === 'idle') return <p className="save-status" role="status" />;
  if (saving.state === 'failed') return <p className="save-status" data-state="failed" role="alert"><TriangleAlert />{saving.error}</p>;
  return <p className="save-status" data-state={saving.state} role="status">
    {saving.state === 'saving' ? <><LoaderCircle />Saving…</> : <><Check />Saved</>}
  </p>;
}
