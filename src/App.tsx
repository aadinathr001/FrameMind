import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptViewer } from './components/TranscriptViewer';
import { SummaryDeck } from './components/SummaryDeck';
import { ChatDeck } from './components/ChatDeck';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { FallbackDrawer } from './components/FallbackDrawer';
import {
  TranscriptSegment,
  VideoMetadata,
  VideoSummary,
  ChatMessage,
  LLMConfig,
} from './types';
import { loadLLMConfig, saveLLMConfig } from './utils/modelConfig';
import {
  Search,
  Upload,
  BookOpen,
  ArrowRight,
  AlertCircle,
  FileText,
  Sparkles,
} from 'lucide-react';

const SAMPLE_VIDEOS = [
  {
    title: 'Andrej Karpathy: Intro to LLMs',
    url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
  },
  {
    title: '3Blue1Brown: Neural Networks',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
  },
  {
    title: 'MIT: Introduction to Algorithms',
    url: 'https://www.youtube.com/watch?v=ZA-tUyM_y7s',
  },
];

export default function App() {
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(loadLLMConfig);
  const [urlInput, setUrlInput] = useState('');
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [activeTab, setActiveTab] = useState<'summary' | 'chat'>('summary');
  const [leftTab, setLeftTab] = useState<'both' | 'video' | 'transcript'>('both');
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);

  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false);

  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isFallbackDrawerOpen, setIsFallbackDrawerOpen] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const handleSaveModelConfig = (newConfig: LLMConfig) => {
    setLlmConfig(newConfig);
    saveLLMConfig(newConfig);
  };

  const handleSeek = useCallback((seconds: number) => {
    setSeekSeconds(seconds);
  }, []);

  const handleClearSeek = useCallback(() => {
    setSeekSeconds(null);
  }, []);

  // Fetch YouTube transcript
  const handleLoadVideo = async (targetUrl?: string) => {
    const urlToFetch = (targetUrl || urlInput).trim();
    if (!urlToFetch) return;

    setIsFetchingTranscript(true);
    setErrorNotice(null);
    setSummary(null);
    setMessages([]);

    try {
      const resp = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to extract video details');
      }

      if (data.fallbackRequired) {
        setVideoMeta(data.video);
        setFallbackReason(data.message);
        setIsFallbackDrawerOpen(true);
        return;
      }

      setVideoMeta(data.video);
      setSegments(data.segments);

      // Auto-trigger summarization
      triggerSummarize(data.segments, data.video.title);
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Error loading video captions.');
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  // Trigger Summarization
  const triggerSummarize = async (
    transcriptSegments?: TranscriptSegment[],
    title?: string
  ) => {
    const segs = transcriptSegments || segments;
    const vTitle = title || videoMeta?.title;

    if (!segs || segs.length === 0) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const resp = await fetch('/api/llm/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: segs,
          videoTitle: vTitle,
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: llmConfig.apiKey,
          baseUrl: llmConfig.baseUrl,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to synthesize summary');
      }

      setSummary(data.data);
    } catch (err: any) {
      console.error('Summary error:', err);
      setSummaryError(err.message || 'Unable to generate synthesis');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Send message in Q&A chat
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !segments.length || isAnsweringQuestion) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnsweringQuestion(true);

    try {
      const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          transcript: segments,
          videoTitle: videoMeta?.title,
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: llmConfig.apiKey,
          baseUrl: llmConfig.baseUrl,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate answer');
      }

      const assistantMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: data.content,
        citations: data.citations,
        timestamp: Date.now(),
      };

      setMessages([...updatedMessages, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: `Error formulating answer: ${err.message}. Please check your model settings.`,
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, errMsg]);
    } finally {
      setIsAnsweringQuestion(false);
    }
  };

  const handleCustomTranscriptLoaded = (
    newSegments: TranscriptSegment[],
    newMeta: VideoMetadata
  ) => {
    setVideoMeta(newMeta);
    setSegments(newSegments);
    setMessages([]);
    setSummary(null);
    triggerSummarize(newSegments, newMeta.title);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-stone-900 selection:bg-[#C85A32]/15 selection:text-[#9B3C18]">
      {/* Top Header */}
      <Header
        llmConfig={llmConfig}
        onOpenModelSettings={() => setIsModelModalOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Hero / Ingestion Strip */}
      <section className="border-b border-[#E7E1D7] bg-[#F7F3EC] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* URL Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLoadVideo();
            }}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube video link (e.g. https://www.youtube.com/watch?v=...)"
                className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-white border border-[#DDD5C9] rounded-md focus:outline-none focus:border-[#C85A32] shadow-2xs transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isFetchingTranscript || !urlInput.trim()}
              className="px-4 py-2 text-xs md:text-sm font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] disabled:opacity-50 disabled:pointer-events-none rounded-md shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              {isFetchingTranscript ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <span>Analyze Video</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fallback / Manual Subtitle Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFallbackReason(null);
                setIsFallbackDrawerOpen(true);
              }}
              className="px-3 py-2 text-xs font-medium text-stone-700 bg-white border border-[#DDD5C9] hover:border-stone-400 rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-stone-500" />
              <span>Paste / Upload Subtitles</span>
            </button>
          </div>

        </div>

        {/* Sample Talk Badges */}
        <div className="max-w-7xl mx-auto mt-2.5 flex items-center gap-2 overflow-x-auto text-[11px] text-stone-500">
          <span className="font-semibold text-stone-600 shrink-0 uppercase tracking-wider text-[10px]">
            Try Sample:
          </span>
          {SAMPLE_VIDEOS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setUrlInput(sample.url);
                handleLoadVideo(sample.url);
              }}
              className="px-2.5 py-1 bg-white hover:bg-[#F2ECE3] border border-[#E0D7CC] rounded text-stone-700 hover:text-stone-900 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {sample.title}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {errorNotice && (
          <div className="max-w-7xl mx-auto mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-medium">{errorNotice}</span>
              <button
                type="button"
                onClick={() => setIsFallbackDrawerOpen(true)}
                className="ml-2 font-semibold underline hover:text-red-900"
              >
                Paste transcript or upload subtitle file instead
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Split Study Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Media & Interactive Transcript (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Video Player Box */}
          <div className="bg-white border border-[#E4DDD2] rounded-lg p-3.5 shadow-2xs">
            <VideoPlayer
              video={videoMeta}
              seekSeconds={seekSeconds}
              onClearSeek={handleClearSeek}
            />
          </div>

          {/* Interactive Timed Transcript */}
          <div className="h-[420px] flex flex-col">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C85A32]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Interactive Transcript
                </h3>
              </div>
              <span className="text-[11px] text-stone-400">
                {segments.length > 0 ? `${segments.length} timestamped passages` : 'Awaiting video'}
              </span>
            </div>

            <TranscriptViewer
              segments={segments}
              onSeek={handleSeek}
              activeSeconds={seekSeconds}
            />
          </div>

        </div>

        {/* Right Column: Intelligence & Discussion Deck (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          
          {/* Tab Switcher on mobile/tablet */}
          <div className="flex items-center justify-between border-b border-[#E4DDD2] pb-2">
            <div className="flex items-center gap-1 p-0.5 bg-[#EFE9E0] rounded-md text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 font-medium rounded-sm transition-colors cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Synthesis & Chapters
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 font-medium rounded-sm transition-colors cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Grounded Q&A
              </button>
            </div>

            <span className="text-[11px] font-mono text-stone-500">
              {llmConfig.provider.toUpperCase()}
            </span>
          </div>

          {/* Deck Body */}
          <div className="flex-1 min-h-[500px]">
            {activeTab === 'summary' ? (
              <SummaryDeck
                summary={summary}
                loading={isGeneratingSummary}
                error={summaryError}
                onGenerateSummary={() => triggerSummarize()}
                onSeek={handleSeek}
                hasTranscript={segments.length > 0}
              />
            ) : (
              <ChatDeck
                messages={messages}
                loading={isAnsweringQuestion}
                onSendMessage={handleSendMessage}
                onSeek={handleSeek}
                onClearChat={() => setMessages([])}
                hasTranscript={segments.length > 0}
                videoTitle={videoMeta?.title}
              />
            )}
          </div>

        </div>

      </main>

      {/* Model Configuration Modal */}
      <ModelSettingsModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        config={llmConfig}
        onSave={handleSaveModelConfig}
      />

      {/* Subtitle / Transcript Fallback Drawer */}
      <FallbackDrawer
        isOpen={isFallbackDrawerOpen}
        onClose={() => setIsFallbackDrawerOpen(false)}
        onTranscriptLoaded={handleCustomTranscriptLoaded}
        initialVideoTitle={videoMeta?.title}
        defaultErrorNotice={fallbackReason}
      />
    </div>
  );
}
