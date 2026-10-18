type Side = 0 | 1;

const THROW = 'cubic-bezier(.5, 0, .75, 0)';

function play(card: HTMLElement | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!card) return Promise.resolve();
  return card.animate(frames, { fill: 'forwards', ...options }).finished.then(() => undefined, () => undefined);
}

export function deal(card: HTMLElement | null | undefined, side: Side) {
  return play(card, [
    { transform: 'translateY(26px) scale(.9)', opacity: 0 },
    { transform: 'translateY(0) scale(1)', opacity: 1 },
  ], { duration: 240, delay: side * 35, easing: 'cubic-bezier(.2, 1.25, .35, 1)', fill: 'backwards' });
}

export function win(cards: (HTMLElement | null)[], side: Side) {
  const lean = side ? -1 : 1;
  return Promise.all([
    play(cards[side], [{ transform: 'none' }, { transform: `translate(${lean * 40}px, -560px) rotate(${lean * 14}deg) scale(1.05)` }], { duration: 280, easing: THROW }),
    play(cards[1 - side], [{ transform: 'none', opacity: 1 }, { transform: 'translateY(60px) scale(.82)', opacity: 0 }], { duration: 200, easing: 'ease-in' }),
  ]);
}

export function tie(cards: (HTMLElement | null)[]) {
  return Promise.all(cards.map((card, side) => play(card, [
    { transform: 'none' },
    { transform: `translateX(${side ? 24 : -24}px) scale(.9)`, opacity: 0 },
  ], { duration: 180, easing: 'ease-in' })));
}

export function skip(cards: (HTMLElement | null)[]) {
  return Promise.all(cards.map((card, side) => play(card, [
    { transform: 'none' },
    { transform: `translateX(${side ? 420 : -420}px) rotate(${side ? 18 : -18}deg)` },
  ], { duration: 200, easing: THROW })));
}
