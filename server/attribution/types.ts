import type { Title } from '../../src/catalog/types.ts';

export interface Attribution {
  record(title: Title): Promise<void>;
  enqueue?(title: Title): Promise<void>;
  stop?(): Promise<void>;
}
