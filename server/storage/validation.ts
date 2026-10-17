import type { CacheSettings } from '../../src/cache/types.ts';
import { GENRE_ID, IMDB_ID, TITLE_ID } from '../../src/catalog/identity.ts';
import { RATINGS, STATUSES, type PersonalPatch, type Rating } from '../../src/library/types.ts';
import { LIMITS } from '../../src/cache/policy.ts';
import { PIN_LENGTH, PROFILE_NAME_LIMIT } from '../../src/profiles/types.ts';

export function validate_id(id: string): void {
  if (TITLE_ID.exec(id)?.[0] !== id) throw new RangeError('Invalid catalog ID');
}

export function validate_series_id(id: string): void {
  if (IMDB_ID.exec(id)?.[0] !== id) throw new RangeError('Invalid series ID');
}

export function validate_season(season: number): void {
  if (!Number.isSafeInteger(season) || season < 0 || season > 99999) throw new RangeError('Invalid season');
}

export function validate_rating(rating: unknown): asserts rating is Rating | null {
  if (rating === null || RATINGS.some(value => value === rating)) return;
  throw new RangeError('Rating must be null or 0.5 to 5 in half steps');
}

export function validate_genre(id: string): void {
  if (GENRE_ID.exec(id)?.[0] !== id) throw new RangeError('Invalid genre ID');
}

export function validate_personal(patch: PersonalPatch): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new RangeError('Invalid personal patch');
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'rating') {
      validate_rating(value);
      continue;
    }
    if (key === 'status') {
      if (value === null || (typeof value === 'string' && STATUSES.some(status => status === value))) continue;
      throw new RangeError('Invalid personal status');
    }
    if ((key === 'favorite' || key === 'recommended' || key === 'saved' || key === 'opened') && typeof value === 'boolean') continue;
    throw new RangeError(`Invalid personal field: ${key}`);
  }
}

export function validate_settings(patch: Partial<CacheSettings>): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new RangeError('Invalid cache settings');
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(LIMITS, key)) throw new RangeError(`Unknown cache setting: ${key}`);
    const [minimum, maximum] = LIMITS[key as keyof CacheSettings];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RangeError(`Invalid cache setting: ${key}`);
    }
  }
}


export function validate_source(source: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(source)) throw new RangeError('Invalid playback source');
}

export function validate_profile_name(name: string): void {
  const length = [...name].length;
  if (length < 1 || length > PROFILE_NAME_LIMIT || /\p{Cc}/u.test(name)) {
    throw new RangeError(`Profile names are 1 to ${PROFILE_NAME_LIMIT} characters.`);
  }
}

export function validate_pin(pin: string): void {
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) throw new RangeError(`A PIN is exactly ${PIN_LENGTH} digits.`);
}
