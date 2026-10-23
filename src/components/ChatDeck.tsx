import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Citation } from '../types';
import { Send, Sparkles, MessageSquare, Trash2, Copy, Check, Play } from 'lucide-react';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (text: string) => void;
  onSeek: (seconds: number) => void;
  onClearChat: () => void;
  hasTranscript: boolean;
  videoTitle?: string;
}

const SAMPLE_PROMPTS = [
  'What is the core premise of this video?',
  'Explain the key points discussed and their evidence.',
  'What practical action items or conclusions are highlighted?',
];

export const ChatDeck: React.FC<Props> = ({
  messages,
  loading,
  onSendMessage,
  onSeek,
  onClearChat,
  hasTranscript,
  videoTitle,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !hasTranscript) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const parseTimestampToSeconds = (ts: string): number => {
    const parts = ts.replace(/[\[\]]/g, '').trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  // Render text and replace [MM:SS] with clickable timestamp jump button
  const renderMessageContent = (content: string) => {
    const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;
      const timestampText = match[1];
      const seconds = parseTimestampToSeconds(timestampText);

      if (matchStart > lastIndex) {
        parts.push(content.substring(lastIndex, matchStart));
      }

      parts.push(
        <button
          key={`ts-${matchStart}`}
          type="button"
          onClick={() => onSeek(seconds)}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.2 text-[11px] font-mono tabular-nums font-semibold text-[#A64A26] bg-[#F8EFE8] hover:bg-[#C85A32] hover:text-white rounded border border-[#E9DACF] transition-colors cursor-pointer align-baseline"
          title={`Seek video to ${timestampText}`}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{timestampText}</span>
        </button>
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#E4DDD2] rounded-lg shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-3 border-b border-[#EBE5DC] bg-[#FAF8F5]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#C85A32]" />
          <span className="text-xs font-semibold text-stone-900">Transcript-Grounded Q&A</span>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
            title="Reset conversation"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-8 px-4 flex flex-col items-center text-center">
            <Sparkles className="w-7 h-7 text-stone-400 stroke-1 mb-2.5" />
            <h3 className="text-xs font-semibold text-stone-900">Ask Any Question About This Video</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xs leading-relaxed">
              Every answer extracts facts directly from the transcript with verified [MM:SS] clickable timestamp citations.
            </p>

            {hasTranscript && (
              <div className="w-full max-w-sm mt-5 space-y-2 text-left">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Suggested Prompts:
                </p>
                {SAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    className="w-full p-2.5 text-xs text-stone-700 bg-[#FAF8F5] hover:bg-[#F3EFE9] border border-[#EBE5DC] rounded-md transition-colors text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <Send className="w-3 h-3 text-stone-400 group-hover:text-[#C85A32] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#C85A32] text-white shadow-2xs'
                    : 'bg-[#FAF8F5] text-stone-800 border border-[#EBE5DC]'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="whitespace-pre-wrap select-text">
                      {renderMessageContent(msg.content)}
                    </div>

                    {/* Citations List if provided */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#EBE5DC] flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] uppercase font-semibold text-stone-400">Jump To:</span>
                        {msg.citations.map((cite, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSeek(cite.seconds)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-[#A64A26] bg-white border border-[#E0D7CC] hover:bg-[#C85A32] hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <Play className="w-2 h-2 fill-current" />
                            <span>{cite.timestamp}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-1 px-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="text-[11px] text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-start gap-2 max-w-[85%] bg-[#FAF8F5] border border-[#EBE5DC] rounded-lg p-3 text-xs text-stone-600">
            <div className="w-3 h-3 border-2 border-[#C85A32] border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
            <span>Consulting transcript citations & formulating grounded response...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#EBE5DC] bg-[#FAF8F5]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!hasTranscript || loading}
            placeholder={
              hasTranscript
                ? 'Ask a question about this video (e.g. "What did they say about...?")'
                : 'Load a video transcript first to enable Q&A'
            }
            className="flex-1 px-3 py-2 text-xs bg-white border border-[#DDD5C9] rounded-md focus:outline-none focus:border-[#C85A32] disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !hasTranscript}
            className="px-3.5 py-2 text-xs font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] disabled:opacity-50 disabled:pointer-events-none rounded-md shadow-2xs transition-colors shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </div>
      </form>
    </div>
  );
};
