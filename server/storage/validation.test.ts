import { describe, expect, it } from 'vitest';
import { validate_genre, validate_id, validate_personal, validate_season, validate_series_id } from './validation.ts';

describe('storage identifier boundaries', () => {
  it.each(['tt1234567', 'tt123456789012', 'tt1234567:0:12345'])(
    'accepts complete title ID %s', id => expect(() => validate_id(id)).not.toThrow());

  it.each(['Q1\n', 'tt1234567\n', 'tt1234567:1:2\n', 'Q1\r\n', 'tt1234567\u2028', 'invalid', 'TT1234567',
    'tt123456', 'tt1234567890123', 'tt1234567:1:123456', '../tt1234567', 'tt1234567:1', ''])(
    'rejects malformed title ID %j', id => expect(() => validate_id(id)).toThrow('Invalid catalog ID'));

  it.each(['tt1234567', 'tt123456789012'])(
    'accepts canonical series ID %s', id => expect(() => validate_series_id(id)).not.toThrow());

  it.each(['tt1234567:1:1', 'tt123456', 'TT1234567', 'tt1234567890123', 'tt1234567\n', ''])(
    'rejects non-canonical series ID %j', id => expect(() => validate_series_id(id)).toThrow('Invalid series ID'));

  it.each([0, 1, 99999])(
    'accepts integer season %s', season => expect(() => validate_season(season)).not.toThrow());

  it.each([-1, 1.5, 100000, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'rejects invalid season %s', season => expect(() => validate_season(season)).toThrow('Invalid season'));

  it.each(['drama', 'science-fiction', '3d-animation'])(
    'accepts complete genre slug %s', id => expect(() => validate_genre(id)).not.toThrow());

  it.each(['drama\n', 'drama\r\n', 'drama\u2029', '1Invalid', 'Drama', '-drama', 'drama-', 'science fiction', ''])(
    'rejects malformed genre slug %j', id => expect(() => validate_genre(id)).toThrow('Invalid genre ID'));
});

describe('personal field boundaries', () => {
  it('accepts status and favorite fields', () => {
    expect(() => validate_personal({ status: 'want', favorite: true })).not.toThrow();
    expect(() => validate_personal({ status: null, favorite: false, saved: true, opened: true })).not.toThrow();
  });

  it.each([
    { status: 'queued' }, { status: 1 }, { favorite: null }, { watched: true }, { unknown: true }, null, [],
  ])('rejects malformed personal fields', patch => {
    expect(() => validate_personal(patch as never)).toThrow(RangeError);
  });
});
