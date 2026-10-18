import { useEffect, useRef } from 'react';

export function NearEnd({ on_reach }: { on_reach: () => void }) {
  const marker = useRef<HTMLDivElement>(null);
  const reach = useRef(on_reach);

  useEffect(() => {
    reach.current = on_reach;
  });

  useEffect(() => {
    const element = marker.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reach.current();
    }, { root: document.getElementById('main-content'), rootMargin: '0px 0px 900px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className="near-end" ref={marker} aria-hidden="true" />;
}
