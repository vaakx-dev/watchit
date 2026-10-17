import { describe, expect, it } from 'vitest';
import { at, step } from './rating';

describe('rating selection', () => {
  it('selects half-star steps and clamps drags outside the control', () => {
    expect(at(-0.2)).toBe(0.5);
    expect(at(0)).toBe(0.5);
    expect(at(0.1)).toBe(0.5);
    expect(at(0.11)).toBe(1);
    expect(at(0.7)).toBe(3.5);
    expect(at(1)).toBe(5);
    expect(at(1.2)).toBe(5);
  });

  it('supports keyboard adjustment, endpoints and clearing without extra buttons', () => {
    expect(step(null, 'ArrowRight')).toBe(0.5);
    expect(step(3, 'ArrowUp')).toBe(3.5);
    expect(step(3, 'ArrowDown')).toBe(2.5);
    expect(step(0.5, 'ArrowLeft')).toBe(0.5);
    expect(step(5, 'ArrowRight')).toBe(5);
    expect(step(3, 'Home')).toBe(0.5);
    expect(step(3, 'End')).toBe(5);
    expect(step(3, 'Delete')).toBeNull();
    expect(step(3, 'Backspace')).toBeNull();
    expect(step(3, 'Tab')).toBeUndefined();
  });
});
