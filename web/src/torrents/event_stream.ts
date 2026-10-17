import { active_session } from '../profiles/session';
import { SESSION_HEADER } from '../profiles/types';

export type StreamEvent = { name: string; data: string };

function parse(block: string): StreamEvent | null {
  let name = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') name = value;
    if (field === 'data') data.push(value);
  }
  return data.length ? { name, data: data.join('\n') } : null;
}

export async function read_events(url: string, on_open: () => void, on_event: (event: StreamEvent) => void, signal: AbortSignal) {
  const headers = new Headers({ Accept: 'text/event-stream' });
  if (active_session) headers.set(SESSION_HEADER, active_session.token);
  const response = await fetch(url, { headers, signal });
  if (!response.ok || !response.body) throw new Error(`Event stream failed (${response.status}).`);
  on_open();
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer = (buffer + value).replace(/\r\n?/g, '\n');
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const event = parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (event) on_event(event);
      end = buffer.indexOf('\n\n');
    }
  }
}
