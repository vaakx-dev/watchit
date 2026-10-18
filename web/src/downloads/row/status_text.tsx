export type Part = string | { text: string; tone: 'ready' | 'failed' };

export function present<T>(parts: Array<T | null | false>) {
  return parts.filter((part): part is T => part !== null && part !== false);
}

function Parts({ parts, layout }: { parts: Part[]; layout: 'narrow' | 'wide' }) {
  return <p className="download-sub" data-layout={layout}>
    {parts.map(part => typeof part === 'string'
      ? <span key={part}>{part}</span>
      : <span key={part.text} data-tone={part.tone}>{part.text}</span>)}
  </p>;
}

export function StatusText({ narrow, wide = narrow }: { narrow: Part[]; wide?: Part[] }) {
  return <>
    <Parts parts={narrow} layout="narrow" />
    <Parts parts={wide} layout="wide" />
  </>;
}
