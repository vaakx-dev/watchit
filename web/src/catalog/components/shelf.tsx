import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionHeader } from '../../ui/section_header';

export function Shelf({ title, link, children }: { title: string; link?: { href: string; label: string }; children: ReactNode }) {
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const [edges, set_edges] = useState({ start: true, end: false });

  function update_edges() {
    const element = row.current;
    if (!element) return;
    const start = element.scrollLeft < 2;
    const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
    set_edges(previous => previous.start === start && previous.end === end ? previous : { start, end });
  }

  useEffect(update_edges);

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const observer = new ResizeObserver(update_edges);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function scroll(direction: number) {
    const element = row.current;
    if (element) element.scrollBy({ left: element.clientWidth * direction });
  }

  return (
    <section className="shelf" aria-labelledby={`${id}-heading`}>
      <SectionHeader id={`${id}-heading`} title={title} link={link}>
        <span className="shelf-controls">
          <button className="icon-button ghost small" aria-label={`Previous ${title}`} aria-controls={id} disabled={edges.start} onClick={() => scroll(-1)}><ChevronLeft /></button>
          <button className="icon-button ghost small" aria-label={`Next ${title}`} aria-controls={id} disabled={edges.end} onClick={() => scroll(1)}><ChevronRight /></button>
        </span>
      </SectionHeader>
      <div className="shelf-row" ref={row} id={id} onScroll={update_edges}>{children}</div>
    </section>
  );
}
