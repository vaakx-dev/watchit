import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { search_route } from '../navigation/route';
import { remember_search } from '../search/recent/api';
import { typing } from '../ui/typing';

const TYPING_DELAY = 250;

export function SearchField({ query }: { query: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [text, set_text] = useState(query ?? '');
  const [shown_query, set_shown_query] = useState(query);
  const [focused, set_focused] = useState(false);

  if (query !== shown_query) {
    set_shown_query(query);
    if ((query ?? '') !== text) set_text(query ?? '');
  }

  useEffect(() => {
    function focus(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  useEffect(() => {
    if (query === null || text === query) return;
    const timer = setTimeout(() => window.location.replace(search_route(text)), TYPING_DELAY);
    return () => clearTimeout(timer);
  }, [text, query]);

  function change(value: string) {
    set_text(value);
    if (query === null) window.location.hash = search_route(value);
  }

  function clear() {
    set_text('');
    if (query !== null) window.location.replace(search_route(''));
  }

  return <form className="search-field-row" role="search" data-active={focused || text !== '' || undefined} onSubmit={event => {
    event.preventDefault();
    if (text.trim()) void remember_search(text);
    input.current?.blur();
  }}>
    <div className="search-field">
      <Search />
      <label className="sr-only" htmlFor="search-input">Search titles</label>
      <input ref={input} id="search-input" value={text} name="q" type="search" enterKeyHint="search"
        maxLength={200} placeholder="Movies, shows, anime" autoComplete="off"
        onChange={event => change(event.target.value)} onFocus={() => set_focused(true)} onBlur={() => set_focused(false)}
        onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur(); }} />
      {text ? <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { clear(); input.current?.focus(); }}><X /></button>
        : <kbd aria-hidden="true">/</kbd>}
    </div>
    <button type="button" className="search-cancel" onMouseDown={event => event.preventDefault()} onClick={() => { clear(); input.current?.blur(); }}>Cancel</button>
  </form>;
}
