import React, { useRef, useEffect } from 'react';
import { VideoMetadata } from '../types';
import { ExternalLink, Play, Film } from 'lucide-react';

interface Props {
  video: VideoMetadata | null;
  seekSeconds: number | null;
  onClearSeek: () => void;
}

export const VideoPlayer: React.FC<Props> = ({ video, seekSeconds, onClearSeek }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (seekSeconds !== null && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seekSeconds, true],
        }),
        '*'
      );
      // Automatically trigger playback
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: [],
        }),
        '*'
      );
      onClearSeek();
    }
  }, [seekSeconds, onClearSeek]);

  if (!video || !video.id) {
    return (
      <div className="w-full aspect-video bg-[#F2EDE4] border border-[#E4DDD2] rounded-lg flex flex-col items-center justify-center text-stone-500 p-6">
        <Film className="w-10 h-10 text-stone-400 stroke-1 mb-2" />
        <p className="text-sm font-medium text-stone-700">No active video loaded</p>
        <p className="text-xs text-stone-500 mt-1 text-center max-w-sm">
          Enter a YouTube video URL above or choose a sample to extract the transcript and start studying.
        </p>
      </div>
    );
  }

  const isCustom = video.id.startsWith('custom-');

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#DDD5C9] shadow-2xs">
        {isCustom ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-300 p-6 text-center">
            <Film className="w-8 h-8 text-stone-400 mb-2 stroke-1" />
            <p className="text-sm font-medium text-stone-100">{video.title}</p>
            <p className="text-xs text-stone-400 mt-1">Manual Transcript Document Mode</p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&origin=${encodeURIComponent(
              typeof window !== 'undefined' ? window.location.origin : ''
            )}&rel=0`}
            title={video.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {/* Video Details Card */}
      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900 line-clamp-1 leading-snug">{video.title}</h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
            <span>{video.author}</span>
            {video.duration > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {Math.floor(video.duration / 60)}m {video.duration % 60}s
                </span>
              </>
            )}
          </div>
        </div>

        {!isCustom && (
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 transition-colors shrink-0"
          >
            <span>YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
