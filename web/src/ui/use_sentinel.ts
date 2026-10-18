import { useCallback, useState } from 'react';

export function use_sentinel(margin = '600px') {
  const [seen, set_seen] = useState(false);
  const ref = useCallback((node: Element | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      set_seen(true);
      observer.disconnect();
    }, { rootMargin: margin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);
  return { seen, ref };
}
