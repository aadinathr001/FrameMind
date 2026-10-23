export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
}

export interface Chapter {
  title: string;
  timestamp: string;
  seconds: number;
  summary: string;
}

export interface VideoSummary {
  overview: string;
  keyTakeaways: string[];
  chapters: Chapter[];
}

export interface Citation {
  timestamp: string;
  seconds: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

export type ModelProvider = 'ollama' | 'groq' | 'gemini' | 'openai';

export interface LLMConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}
