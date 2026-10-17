const RESOLUTION_LABELS: Record<string, string> = { '2160p': '4K', '1440p': '2K', '1080p': '1080p', '720p': '720p', '480p': '480p' };

export function resolution_label(resolution: string | null) {
  return resolution ? RESOLUTION_LABELS[resolution] ?? resolution : null;
}

