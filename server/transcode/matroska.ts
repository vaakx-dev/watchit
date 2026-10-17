const SEGMENT = 0x18538067;
const SEEK_HEAD = 0x114d9b74;
const SEEK = 0x4dbb;
const SEEK_ID = 0x53ab;
const SEEK_POSITION = 0x53ac;
const INFO = 0x1549a966;
const TIMESTAMP_SCALE = 0x2ad7b1;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_NUMBER = 0xd7;
const TRACK_TYPE = 0x83;
const VIDEO_TRACK = 1;
const CUES = 0x1c53bb6b;
const CUE_POINT = 0xbb;
const CUE_TIME = 0xb3;
const CUE_TRACK_POSITIONS = 0xb7;
const CUE_TRACK = 0xf7;
const HEAD_BYTES = 64 * 1024;
const HEADER_BYTES = 12;

type Element = { id: number; start: number; end: number };

async function fetch_bytes(url: string, start: number, length: number): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { range: `bytes=${start}-${start + length - 1}` } });
  if (response.status !== 206) throw new Error(`Range request failed with ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

function vint(bytes: Uint8Array, position: number, keep_marker: boolean): { value: number; length: number } | null {
  const first = bytes[position];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23;
  if (position + length > bytes.length) return null;
  let value = keep_marker ? first : first & (0xff >> length);
  for (let index = 1; index < length; index += 1) value = value * 256 + (bytes[position + index] ?? 0);
  return { value, length };
}

function element_at(bytes: Uint8Array, position: number): Element | null {
  const id = vint(bytes, position, true);
  if (!id) return null;
  const size = vint(bytes, position + id.length, false);
  if (!size) return null;
  const start = position + id.length + size.length;
  return { id: id.value, start, end: start + size.value };
}

function children(bytes: Uint8Array, parent: { start: number; end: number }): Element[] {
  const found: Element[] = [];
  const end = Math.min(parent.end, bytes.length);
  let position = parent.start;
  while (position < end) {
    const element = element_at(bytes, position);
    if (!element) break;
    found.push(element);
    position = element.end;
  }
  return found;
}

function unsigned(bytes: Uint8Array, element: Element): number {
  let value = 0;
  for (let index = element.start; index < element.end; index += 1) value = value * 256 + (bytes[index] ?? 0);
  return value;
}

function child_value(bytes: Uint8Array, parent: Element, id: number): number | null {
  const child = children(bytes, parent).find(element => element.id === id);
  return child ? unsigned(bytes, child) : null;
}

async function read_element(url: string, offset: number): Promise<{ bytes: Uint8Array; element: Element }> {
  const header = await fetch_bytes(url, offset, HEADER_BYTES);
  const element = element_at(header, 0);
  if (!element) throw new Error('Invalid Matroska element.');
  const bytes = await fetch_bytes(url, offset + element.start, element.end - element.start);
  return { bytes, element: { id: element.id, start: 0, end: bytes.length } };
}

function seek_positions(head: Uint8Array): Map<number, number> {
  const positions = new Map<number, number>();
  const header = element_at(head, 0);
  const segment = header && element_at(head, header.end);
  if (!segment || segment.id !== SEGMENT) return positions;
  for (const seek_head of children(head, segment).filter(element => element.id === SEEK_HEAD)) {
    for (const seek of children(head, seek_head).filter(element => element.id === SEEK)) {
      const id = child_value(head, seek, SEEK_ID);
      const position = child_value(head, seek, SEEK_POSITION);
      if (id !== null && position !== null) positions.set(id, segment.start + position);
    }
  }
  return positions;
}

function video_track(bytes: Uint8Array, tracks: Element): number | null {
  const entry = children(bytes, tracks)
    .filter(element => element.id === TRACK_ENTRY)
    .find(element => child_value(bytes, element, TRACK_TYPE) === VIDEO_TRACK);
  return entry ? child_value(bytes, entry, TRACK_NUMBER) : null;
}

function cue_times(bytes: Uint8Array, cues: Element, track: number): number[] {
  const times: number[] = [];
  for (const point of children(bytes, cues).filter(element => element.id === CUE_POINT)) {
    const parts = children(bytes, point);
    const time = parts.find(element => element.id === CUE_TIME);
    const on_track = parts.some(element => element.id === CUE_TRACK_POSITIONS && child_value(bytes, element, CUE_TRACK) === track);
    if (time && on_track) times.push(unsigned(bytes, time));
  }
  return times;
}

export async function matroska_keyframes(url: string): Promise<number[] | null> {
  const positions = seek_positions(await fetch_bytes(url, 0, HEAD_BYTES));
  const tracks_at = positions.get(TRACKS);
  const cues_at = positions.get(CUES);
  if (tracks_at === undefined || cues_at === undefined) return null;
  const tracks = await read_element(url, tracks_at);
  const track = video_track(tracks.bytes, tracks.element);
  if (track === null) return null;
  const info_at = positions.get(INFO);
  const info = info_at === undefined ? null : await read_element(url, info_at);
  const scale = (info && child_value(info.bytes, info.element, TIMESTAMP_SCALE)) ?? 1_000_000;
  const cues = await read_element(url, cues_at);
  const times = cue_times(cues.bytes, cues.element, track).map(time => (time * scale) / 1e9);
  return [...new Set(times)].sort((a, b) => a - b);
}
