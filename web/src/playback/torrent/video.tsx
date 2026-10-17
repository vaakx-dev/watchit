import { useEffect, useRef } from 'react';
import type { TorrentStream } from './types';

export function TorrentVideo({ stream, label }: { stream: TorrentStream; label: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (stream.mode === 'direct') {
      element.src = stream.url;
      return () => element.removeAttribute('src');
    }
    let release = () => element.removeAttribute('src');
    let closed = false;
    void import('hls.js').then(({ default: Hls }) => {
      if (closed) return;
      if (!Hls.isSupported()) {
        element.src = stream.url;
        return;
      }
      const hls = new Hls();
      hls.loadSource(stream.url);
      hls.attachMedia(element);
      release = () => hls.destroy();
    });
    return () => {
      closed = true;
      release();
    };
  }, [stream.mode, stream.url]);

  return <video ref={video} aria-label={label} controls autoPlay playsInline />;
}
