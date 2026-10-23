import React, { useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptLoaded: (segments: any[], videoMeta: any) => void;
  initialVideoTitle?: string;
  defaultErrorNotice?: string | null;
}

export const FallbackDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  onTranscriptLoaded,
  initialVideoTitle,
  defaultErrorNotice,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState(initialVideoTitle || 'Custom Video Study');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Please provide transcript text.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const resp = await fetch('/api/transcript/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          videoTitle: title.trim() || 'Uploaded Transcript',
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse transcript');
      }

      onTranscriptLoaded(data.segments, data.video);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error parsing transcript text');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        if (!title || title === 'Custom Video Study') {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#FAF7F2] border border-[#E2DBD0] rounded-xl shadow-xl overflow-hidden flex flex-col text-stone-800">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D7] bg-[#F4EFEA]">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Custom Transcript Ingestion</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Paste or upload a subtitle file (.srt, .vtt, .txt) when YouTube captions are unavailable
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {defaultErrorNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{defaultErrorNotice}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Document / Video Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Stanford CS229 Lecture 1"
              className="w-full px-3 py-2 text-xs bg-white border border-[#DDD5C9] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors"
            />
          </div>

          <div className="flex border-b border-[#E8E2D7] gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'paste' ? 'border-[#C85A32] text-stone-900 font-semibold' : 'border-transparent text-stone-500'
              }`}
            >
              Paste Transcript
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'upload' ? 'border-[#C85A32] text-stone-900 font-semibold' : 'border-transparent text-stone-500'
              }`}
            >
              Upload Subtitle File (.srt, .vtt)
            </button>
          </div>

          {activeTab === 'upload' && (
            <div className="p-4 bg-white border border-dashed border-[#DDD5C9] rounded-lg text-center">
              <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-xs font-medium text-[#C85A32] hover:underline">Click to browse file</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-stone-400 mt-1">Supports SRT, WebVTT, and plain text with timestamps</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Transcript Text & Timestamp Data
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw text or formatted subtitles here, e.g.:&#10;[00:15] Welcome everyone to today's research lecture.&#10;[01:30] Let's begin by defining the primary architecture..."
              className="w-full p-3 text-xs font-mono bg-white border border-[#DDD5C9] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[#E8E2D7] bg-[#F4EFEA]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={isSubmitting || !rawText.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] disabled:opacity-50 disabled:pointer-events-none rounded-md shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Parsing...' : 'Load Into Workspace'}
          </button>
        </div>

      </div>
    </div>
  );
};
