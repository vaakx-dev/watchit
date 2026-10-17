import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function data_directory(directory?: string): string {
  return resolve(directory ?? process.env.STREAMIT_DATA_DIR ?? fileURLToPath(new URL('../../data/', import.meta.url)));
}

export function image_path(directory: string, key: string): string {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new RangeError('Invalid image key');
  return resolve(directory, 'images', key);
}

export function dev_pin_file(): string {
  return resolve(process.env.STREAMIT_DEV_PIN_FILE ?? fileURLToPath(new URL('../../../watchit-dev-pin.txt', import.meta.url)));
}
