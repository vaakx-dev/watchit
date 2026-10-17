export const SEGMENT_SECONDS = 6;

export type Segment = { start: number; duration: number };

function from_cuts(cuts: number[], end: number): Segment[] {
  return cuts.map((start, index) => ({ start, duration: (cuts[index + 1] ?? end) - start }));
}

export function equal_segments(start: number, duration: number): Segment[] {
  const count = Math.max(1, Math.round(duration / SEGMENT_SECONDS));
  const cuts = Array.from({ length: count }, (_, index) => start + index * SEGMENT_SECONDS);
  return from_cuts(cuts, start + duration);
}

export function keyframe_segments(keyframes: number[], start: number, duration: number): Segment[] {
  const end = start + duration;
  const cuts = [start];
  for (const keyframe of keyframes) {
    const previous = cuts[cuts.length - 1] ?? start;
    if (keyframe < end && keyframe - previous >= SEGMENT_SECONDS) cuts.push(keyframe);
  }
  return from_cuts(cuts, end);
}
