import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { imported, title } from './fixtures.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

let directory: string;
let store: Store;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-related-'));
  store = create_store(directory);
});
afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

it('ranks similar titles of the same kind without the title itself or its franchise, settled titles last', () => {
  const current = title('tt0000001', { genres: ['Sci-Fi', 'Action'], director: 'Ann Lee' });
  store.title_put([current, title('tt0000002', { genres: ['Science Fiction', 'Action'] }),
    title('tt0000003', { genres: ['Science Fiction', 'Action'], director: 'Ann Lee' }), title('tt0000004', { genres: ['Science Fiction', 'Action'] }),
    title('tt0000005', { genres: ['Action'], kind: 'series' }), title('tt0000006', { genres: ['Science Fiction', 'Action'], director: 'Ann Lee' }),
    title('tt0000007', { genres: ['Drama'] })].map(imported));
  const profile = store.profile_create('test').id;
  store.personal_update(profile, 'tt0000006', { status: 'watched' });

  const ids = store.similar_titles(current, ['tt0000002'], profile).map(entry => entry.id);

  expect(ids).toEqual(['tt0000003', 'tt0000004', 'tt0000006']);
});
