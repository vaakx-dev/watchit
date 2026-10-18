import { useLayoutEffect, useRef, useState } from 'react';

export function TitleSynopsis({ text }: { text: string }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, set_expanded] = useState(false);
  const [clamped, set_clamped] = useState(false);

  useLayoutEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () => set_clamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return <div className="title-synopsis" data-expanded={expanded || undefined}>
    <p ref={paragraph}>{text}</p>
    {clamped && !expanded && <button type="button" className="synopsis-more" onClick={() => set_expanded(true)}>more</button>}
  </div>;
}
