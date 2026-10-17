import { useLayoutEffect, useRef } from 'react';

export function Heading({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    let width = 0;

    const fit = () => {
      width = heading.getBoundingClientRect().width;
      if (!width) return;
      heading.style.removeProperty('font-size');
      const style = getComputedStyle(heading);
      const measure = document.createElement('span');
      measure.textContent = title;
      measure.setAttribute('aria-hidden', 'true');
      Object.assign(measure.style, {
        position: 'fixed', top: '0', left: '0', visibility: 'hidden', pointerEvents: 'none',
        width: 'min-content', font: style.font, letterSpacing: style.letterSpacing,
        textTransform: style.textTransform, whiteSpace: 'normal', wordBreak: 'normal',
        overflowWrap: 'normal', hyphens: 'none',
      });
      document.body.append(measure);
      const word_width = measure.getBoundingClientRect().width;
      measure.remove();
      if (word_width > width) {
        heading.style.fontSize = `${Math.max(28, Math.floor(parseFloat(style.fontSize) * width / word_width))}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(() => { if (heading.getBoundingClientRect().width !== width) fit(); });
    observer.observe(heading);
    window.addEventListener('resize', fit);
    document.fonts.addEventListener('loadingdone', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [title]);

  return <h1 ref={ref} id="featured-title" className={`display${title.length > 22 ? ' long-title' : ''}`}>{title}</h1>;
}
