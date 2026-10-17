import { useRef, useState } from 'react';
import { Choices } from '../../ui/choices';
import { Film, X } from 'lucide-react';
import type { Trailer } from '../types';

const PERMISSIONS = 'autoplay; encrypted-media; fullscreen; picture-in-picture';

export function TrailerAction({ title, trailers }: { title: string; trailers: readonly Trailer[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [playing, set_playing] = useState<string | null>(null);
  const [first] = trailers;
  if (!first) return null;

  function close() { dialog.current?.close(); }

  return <>
    <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => {
      set_playing(first.id);
      dialog.current?.showModal();
    }}><Film />Trailer</button>
    <dialog ref={dialog} className="trailer-dialog" aria-label={`${title} trailer`} onClose={() => set_playing(null)}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="trailer-panel">
        <div className="trailer-bar">
          <h2>{title}</h2>
          <button type="button" className="icon-button ghost" aria-label="Close trailer" onClick={close}><X /></button>
        </div>
        <div className="trailer-frame">
          {playing && <iframe key={playing} src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1`} title={`${title} trailer`}
            allow={PERMISSIONS} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        </div>
        {trailers.length > 1 && <Choices label="Trailers" value={playing ?? first.id} on_change={set_playing}
          options={trailers.map((trailer, index) => ({ value: trailer.id, label: `Trailer ${index + 1}` }))} />}
      </div>
    </dialog>
  </>;
}
