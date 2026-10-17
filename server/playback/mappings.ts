import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Title } from '../../src/catalog/types.ts';

type ProviderMappings = Record<string, { one_anime?: string }>;

let loaded: { path: string; modified: number; mappings: ProviderMappings } | undefined;

async function provider_mappings(directory: string): Promise<ProviderMappings> {
  const path = join(directory, 'providers.json');
  const modified = (await stat(path)).mtimeMs;
  if (loaded?.path !== path || loaded.modified !== modified) {
    loaded = { path, modified, mappings: JSON.parse(await readFile(path, 'utf8')) as ProviderMappings };
  }
  return loaded.mappings;
}

export async function with_provider_ids(title: Title, directory: string): Promise<Title> {
  let mappings: ProviderMappings;
  try {
    mappings = await provider_mappings(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return title;
    throw error;
  }

  const mapping = mappings[title.id];
  const one_anime = mapping?.one_anime;
  if (one_anime === undefined) return title;
  if (typeof one_anime !== 'string' || !/^[a-f0-9]{32}$/.test(one_anime)) {
    throw new Error(`Invalid 1Anime mapping for ${title.id} in providers.json.`);
  }
  return { ...title, provider_ids: { one_anime } };
}
