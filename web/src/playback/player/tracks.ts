export type TrackOption = { id: number; label: string; detail: string | null };

type Described = { language: string | null; title: string | null; codec: string | null; channels: number | null };

const names = new Intl.DisplayNames(undefined, { type: 'language' });

function language(code: string | null) {
  if (!code || code === 'und') return null;
  try { return names.of(code) ?? code; }
  catch { return code; }
}

const CODEC_NAMES: Record<string, string> = {
  subrip: 'SRT',
  ass: 'ASS',
  ssa: 'SSA',
  webvtt: 'WebVTT',
  mov_text: 'Text',
  hdmv_pgs_subtitle: 'PGS',
  dvd_subtitle: 'VobSub',
  dvb_subtitle: 'DVB',
  eac3: 'E-AC-3',
  ac3: 'AC-3',
  truehd: 'TrueHD',
  dts: 'DTS',
};

function codec_name(codec: string | null) {
  return codec ? CODEC_NAMES[codec.toLowerCase()] ?? codec.toUpperCase() : null;
}

function channel_layout(channels: number | null) {
  if (!channels) return null;
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  return `${channels - 1}.1`;
}

export function track_option(id: number, track: Described, index: number): TrackOption {
  const name = language(track.language);
  const detail = [track.title !== name ? track.title : null, codec_name(track.codec), channel_layout(track.channels)].filter(Boolean).join(' · ');
  return { id, label: name ?? track.title ?? `Track ${index + 1}`, detail: detail || null };
}
