import { LLMConfig, ModelProvider } from '../types';

const STORAGE_KEY = 'frameMind_llm_config';

export const DEFAULT_CONFIGS: Record<ModelProvider, { model: string; defaultBaseUrl?: string }> = {
  gemini: {
    model: 'gemini-3.1-flash-lite',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
  },
  openai: {
    model: 'gpt-4o-mini',
  },
  ollama: {
    model: 'llama3.2',
    defaultBaseUrl: 'http://127.0.0.1:11434',
  },
};

export const PROVIDER_LABELS: Record<ModelProvider, { name: string; tag: string; description: string }> = {
  gemini: {
    name: 'Gemini',
    tag: 'Cloud Built-in',
    description: 'Fast, comprehensive video analysis and chapter extraction',
  },
  groq: {
    name: 'Groq',
    tag: 'Ultra Fast',
    description: 'Near-instant inference powered by Llama 3.3 70B',
  },
  openai: {
    name: 'OpenAI',
    tag: 'GPT-4o',
    description: 'Precise reasoning and high-fidelity syntheses',
  },
  ollama: {
    name: 'Ollama',
    tag: 'Local & Private',
    description: 'Runs 100% locally on your machine with zero data transmission',
  },
};

export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && DEFAULT_CONFIGS[parsed.provider as ModelProvider]) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  return {
    provider: 'gemini',
    model: DEFAULT_CONFIGS.gemini.model,
  };
}

export function saveLLMConfig(config: LLMConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    // ignore
  }
}
