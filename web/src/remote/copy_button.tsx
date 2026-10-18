import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, set_copied] = useState(false);
  if (!navigator.clipboard) return null;

  async function copy() {
    await navigator.clipboard.writeText(text);
    set_copied(true);
    setTimeout(() => set_copied(false), 1800);
  }

  return <button className="button secondary small" type="button" aria-label={`Copy ${label}`} onClick={() => void copy()}>{copied ? <><Check />Copied</> : <><Copy />Copy</>}</button>;
}
