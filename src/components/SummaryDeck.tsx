import React, { useState } from 'react';
import { VideoSummary, Chapter } from '../types';
import { Sparkles, RefreshCw, Copy, Check, Clock, Bookmark, ListOrdered, FileDown } from 'lucide-react';

interface Props {
  summary: VideoSummary | null;
  loading: boolean;
  error?: string | null;
  onGenerateSummary: () => void;
  onSeek: (seconds: number) => void;
  hasTranscript: boolean;
}

export const SummaryDeck: React.FC<Props> = ({
  summary,
  loading,
  error,
  onGenerateSummary,
  onSeek,
  hasTranscript,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<'all' | 'overview' | 'takeaways' | 'chapters'>('all');

  const handleCopyMarkdown = () => {
    if (!summary) return;
    let md = `# Video Synthesis & Summary\n\n`;
    md += `## Executive Overview\n${summary.overview}\n\n`;
    md += `## Key Takeaways\n`;
    summary.keyTakeaways.forEach((t, i) => {
      md += `${i + 1}. ${t}\n`;
    });
    md += `\n## Chapter Breakdown\n`;
    summary.chapters.forEach((c) => {
      md += `- **[${c.timestamp}] ${c.title}**: ${c.summary}\n`;
    });

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-[#E4DDD2] rounded-lg shadow-2xs space-y-4">
        <div className="w-8 h-8 border-2 border-[#C85A32] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-stone-800">Synthesizing Video & Chapters</p>
          <p className="text-xs text-stone-500 mt-1 max-w-xs">
            Analyzing transcript context, structuring key takeaways, and aligning chapter markers...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50/60 border border-red-200/80 rounded-lg text-stone-800">
        <h3 className="text-sm font-semibold text-red-900">Synthesis Error</h3>
        <p className="text-xs text-red-700 mt-1 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onGenerateSummary}
          className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] rounded-md transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white border border-[#E4DDD2] rounded-lg shadow-2xs text-center">
        <Bookmark className="w-8 h-8 text-stone-400 stroke-1 mb-2.5" />
        <h3 className="text-sm font-semibold text-stone-900">Structured Video Synthesis</h3>
        <p className="text-xs text-stone-500 mt-1 max-w-sm leading-relaxed">
          Generate an executive brief, high-level takeaways, and clickable chapter timeline from the video transcript.
        </p>
        <button
          type="button"
          onClick={onGenerateSummary}
          disabled={!hasTranscript}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] disabled:opacity-50 disabled:pointer-events-none rounded-md shadow-xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generate Synthesis & Chapters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white border border-[#E4DDD2] rounded-lg shadow-2xs overflow-hidden">
      {/* Deck Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[#EBE5DC] bg-[#FAF8F5]">
        <div className="flex items-center gap-1 p-0.5 bg-[#EFE9E0] rounded-md text-xs">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-2.5 py-1 font-medium rounded-sm transition-colors cursor-pointer ${
              activeSection === 'all' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Full View
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`px-2.5 py-1 font-medium rounded-sm transition-colors cursor-pointer ${
              activeSection === 'overview' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('takeaways')}
            className={`px-2.5 py-1 font-medium rounded-sm transition-colors cursor-pointer ${
              activeSection === 'takeaways' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Takeaways
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('chapters')}
            className={`px-2.5 py-1 font-medium rounded-sm transition-colors cursor-pointer ${
              activeSection === 'chapters' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Chapters
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-[#DDD5C9] rounded-md transition-colors cursor-pointer"
            title="Copy as Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Export MD'}</span>
          </button>
          <button
            type="button"
            onClick={onGenerateSummary}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title="Re-synthesize with current model"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-22rem)] text-stone-800">
        
        {/* Executive Overview */}
        {(activeSection === 'all' || activeSection === 'overview') && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <Bookmark className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Executive Overview</span>
            </div>
            <div className="text-xs text-stone-700 leading-relaxed space-y-2.5 bg-[#FAF8F5] p-3.5 rounded-lg border border-[#EFE9E0]">
              {summary.overview.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* Key Takeaways */}
        {(activeSection === 'all' || activeSection === 'takeaways') && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <ListOrdered className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Key Takeaways & Insights</span>
            </div>
            <div className="space-y-2">
              {summary.keyTakeaways.map((takeaway, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-white border border-[#EAE4DB] rounded-lg hover:border-stone-300 transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-[#A64A26] shrink-0 pt-0.5">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <p className="text-xs text-stone-700 leading-relaxed">{takeaway}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chapter Breakdown */}
        {(activeSection === 'all' || activeSection === 'chapters') && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-500">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Chapter Breakdown</span>
              </div>
              <span className="text-[11px] font-normal normal-case text-stone-400">Click to scrub video</span>
            </div>

            <div className="space-y-2">
              {summary.chapters.map((chapter: Chapter, idx: number) => (
                <div
                  key={idx}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#FAF8F5] border border-[#EAE4DB] hover:border-[#C85A32]/40 rounded-lg transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSeek(chapter.seconds)}
                        className="px-2 py-0.5 text-xs font-mono font-semibold text-[#A64A26] bg-[#F7EFE9] group-hover:bg-[#C85A32] group-hover:text-white rounded transition-colors cursor-pointer"
                        title={`Seek to ${chapter.timestamp}`}
                      >
                        {chapter.timestamp}
                      </button>
                      <h4 className="text-xs font-semibold text-stone-900">{chapter.title}</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed pl-1">{chapter.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};
