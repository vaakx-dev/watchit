import { useEffect, useRef } from 'react';
import type { Library } from './use_library';

export function use_library_refresh(library: Library, refresh: () => void) {
  const seen = useRef(library.entries);

  useEffect(() => {
    if (library.pending || seen.current === library.entries) return;
    seen.current = library.entries;
    refresh();
  }, [library.entries, library.pending, refresh]);
}
