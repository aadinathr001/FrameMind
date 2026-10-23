import React, { useState, useMemo } from 'react';
import { TranscriptSegment } from '../types';
import { Search, Copy, Check, Download, FileText } from 'lucide-react';

interface Props {
  segments: TranscriptSegment[];
  onSeek: (seconds: number) => void;
  activeSeconds?: number | null;
}

function formatSeconds(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return `${m.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
}

export const TranscriptViewer: React.FC<Props> = ({ segments, onSeek }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  const handleCopy = () => {
    const fullText = segments
      .map((s) => `[${formatSeconds(s.start)}] ${s.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullText = segments
      .map((s) => `[${formatSeconds(s.start)}] ${s.text}`)
      .join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#E4DDD2] rounded-lg shadow-2xs overflow-hidden">
      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-[#EBE5DC] bg-[#FAF8F5]">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within transcript..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#DDD5C9] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-[#DDD5C9] hover:border-stone-400 rounded-md transition-colors cursor-pointer"
            title="Copy full transcript"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-[#DDD5C9] hover:border-stone-400 rounded-md transition-colors cursor-pointer"
            title="Download transcript file"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Segment Counter */}
      <div className="px-3.5 py-1.5 bg-[#F6F2EC] border-b border-[#EBE5DC] flex items-center justify-between text-[11px] text-stone-500 font-medium">
        <span>{filteredSegments.length} segments {searchQuery && `matching "${searchQuery}"`}</span>
        <span className="text-stone-400">Click timestamp to seek video</span>
      </div>

      {/* Transcript Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F2EDE4] p-1">
        {filteredSegments.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500 flex flex-col items-center">
            <FileText className="w-8 h-8 text-stone-400 stroke-1 mb-2" />
            <p className="font-medium text-stone-700">No matching transcript segments found</p>
            <p className="text-stone-400 mt-0.5">Try searching for a different keyword</p>
          </div>
        ) : (
          filteredSegments.map((seg, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-3 p-2.5 rounded-md hover:bg-[#FAF7F2] transition-colors"
            >
              <button
                type="button"
                onClick={() => onSeek(seg.start)}
                className="shrink-0 px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-[#A64A26] bg-[#F7EFE9] group-hover:bg-[#C85A32] group-hover:text-white rounded transition-colors font-medium cursor-pointer"
                title={`Seek video to ${formatSeconds(seg.start)}`}
              >
                {formatSeconds(seg.start)}
              </button>
              <p className="text-xs text-stone-700 leading-relaxed select-text">
                {highlightText(seg.text, searchQuery)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-200/70 text-stone-900 rounded px-0.5 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
