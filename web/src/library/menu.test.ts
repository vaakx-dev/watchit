import { describe, expect, it } from 'vitest';
import { menu_step, popover_position } from './menu';

const viewport = { width: 1440, height: 900 };
const panel = { width: 248, height: 300 };

describe('status menu placement', () => {
  it('opens below the trigger, aligned to its left edge', () => {
    expect(popover_position({ top: 300, bottom: 338, left: 200 }, panel, viewport)).toEqual({ left: 200, top: 344 });
  });

  it('flips above when the panel does not fit below', () => {
    expect(popover_position({ top: 700, bottom: 738, left: 200 }, panel, viewport)).toEqual({ left: 200, top: 394 });
  });

  it('keeps the side with more room and stays inside the viewport when neither side fits', () => {
    const short = { width: 390, height: 500 };
    expect(popover_position({ top: 200, bottom: 238, left: 300 }, panel, short)).toEqual({ left: 130, top: 188 });
    expect(popover_position({ top: 300, bottom: 338, left: 4 }, panel, short)).toEqual({ left: 12, top: 12 });
  });
});

describe('status menu keys', () => {
  it('moves through the items and wraps at both ends', () => {
    expect(menu_step('ArrowDown', 0, 6)).toBe(1);
    expect(menu_step('ArrowRight', 5, 6)).toBe(0);
    expect(menu_step('ArrowUp', 0, 6)).toBe(5);
    expect(menu_step('ArrowLeft', 3, 6)).toBe(2);
    expect(menu_step('Home', 3, 6)).toBe(0);
    expect(menu_step('End', 0, 6)).toBe(5);
  });

  it('enters the list from outside it and ignores other keys', () => {
    expect(menu_step('ArrowDown', -1, 6)).toBe(0);
    expect(menu_step('ArrowUp', -1, 6)).toBe(5);
    expect(menu_step('Enter', 2, 6)).toBeUndefined();
  });
});
