import type { SearchKind, TorrentResult } from './types.ts';

const GB = 1024 ** 3;
const IDEAL_SIZE: Record<SearchKind, number> = { movie: 4 * GB, series: 1.5 * GB };

function resolution_score(result: TorrentResult): number {
  const label = `${result.quality ?? ''} ${result.name}`.toLowerCase();
  if (/\b(cam|ts|telesync|scr|screener)\b/.test(label)) return -6;
  if (/1080p/.test(label)) return 4;
  if (/720p/.test(label)) return 3;
  if (/\b(4k|2160p)\b/.test(label)) return 1;
  if (/480p|\bsd\b/.test(label)) return 0;
  return 1;
}

function encoding_penalty(result: TorrentResult): number {
  const label = `${result.quality ?? ''} ${result.name}`.toLowerCase();
  let penalty = 0;
  if (/\bremux\b/.test(label)) penalty += 3;
  if (/\b(dv|dolby ?vision)\b/.test(label)) penalty += 2;
  if (/\b(iso|bdmv|complete bluray)\b/.test(label)) penalty += 4;
  return penalty;
}

function size_penalty(result: TorrentResult, kind: SearchKind): number {
  if (result.size_bytes === null) return 1;
  const ratio = result.size_bytes / IDEAL_SIZE[kind];
  return ratio > 1 ? Math.log2(ratio) * 2.5 : 0;
}

function seeder_score(result: TorrentResult): number {
  if (result.seeders === null) return 0;
  if (result.seeders === 0) return -20;
  return Math.log2(result.seeders + 1) * 1.5;
}

function score(result: TorrentResult, kind: SearchKind): number {
  return seeder_score(result) + resolution_score(result) - encoding_penalty(result) - size_penalty(result, kind);
}

export function rank_results(results: TorrentResult[], kind: SearchKind): TorrentResult[] {
  return results
    .map(result => ({ result, score: score(result, kind) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.result);
}
