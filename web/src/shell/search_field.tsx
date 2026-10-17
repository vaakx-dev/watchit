import { useEffect, useRef } from 'react';
import { Icon } from '../ui/icon';
import { search_route } from '../navigation/route';

function typing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null);
}

export function SearchField({ query }: { query: string | null }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focus(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  return <form className="search-field" role="search" onSubmit={event => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    if (typeof value === 'string') window.location.hash = search_route(value);
  }}>
    <Icon name="search" size={15} />
    <label className="sr-only" htmlFor="search-input">Search titles</label>
    <input ref={input} id="search-input" key={query ?? 'idle'} defaultValue={query ?? ''} name="q" type="search"
      maxLength={200} placeholder="Search titles" autoComplete="off"
      onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur(); }} />
    <kbd aria-hidden="true">/</kbd>
  </form>;
}
