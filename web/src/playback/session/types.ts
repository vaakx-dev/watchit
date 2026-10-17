export type FileSource = { info_hash: string; file_index: number };

export type SessionAudioTrack = { index: number; language: string | null; title: string | null; codec: string; channels: number; default: boolean };

export type SessionSubtitleTrack = { index: number; language: string | null; title: string | null; codec: string; default: boolean; url: string | null };

export type PlaybackSession = {
  id: string;
  mode: 'direct' | 'remux' | 'audio' | 'transcode';
  protocol: 'file' | 'hls';
  url: string;
  duration_seconds: number | null;
  video: { codec: string; width: number; height: number; hdr: string | null } | null;
  audio_tracks: SessionAudioTrack[];
  subtitle_tracks: SessionSubtitleTrack[];
};

export type SessionTracks = { audio_track?: number; subtitle_track?: number | null };
