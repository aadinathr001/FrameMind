import React from 'react';
import { LLMConfig } from '../types';
import { PROVIDER_LABELS } from '../utils/modelConfig';
import { Settings, Cpu, Server, Sparkles, Shield } from 'lucide-react';

interface Props {
  llmConfig: LLMConfig;
  onOpenModelSettings: () => void;
  activeTab: 'summary' | 'chat';
  onTabChange: (tab: 'summary' | 'chat') => void;
}

export const Header: React.FC<Props> = ({
  llmConfig,
  onOpenModelSettings,
  activeTab,
  onTabChange,
}) => {
  const providerInfo = PROVIDER_LABELS[llmConfig.provider];

  const getProviderIcon = () => {
    switch (llmConfig.provider) {
      case 'ollama':
        return <Server className="w-3.5 h-3.5 text-stone-600" />;
      case 'groq':
        return <Cpu className="w-3.5 h-3.5 text-stone-600" />;
      case 'openai':
        return <Shield className="w-3.5 h-3.5 text-stone-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-[#E7E1D7] bg-[#FAF7F2] sticky top-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap">
          Notebook<span className="text-[#C85A32]">Q</span>
        </a>
        <span className="hidden sm:inline text-xs text-stone-400 font-normal">|</span>
        <span className="hidden sm:inline text-xs text-stone-500 font-normal">Video Research & Study</span>
      </div>

      {/* Zone 2: Clean single-line navigation tabs */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-600">
        <button
          type="button"
          onClick={() => onTabChange('summary')}
          className={`pb-0.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'summary'
              ? 'border-[#C85A32] text-stone-900 font-semibold'
              : 'border-transparent hover:text-stone-900'
          }`}
        >
          Synthesis & Chapters
        </button>
        <button
          type="button"
          onClick={() => onTabChange('chat')}
          className={`pb-0.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'chat'
              ? 'border-[#C85A32] text-stone-900 font-semibold'
              : 'border-transparent hover:text-stone-900'
          }`}
        >
          Grounded Q&A
        </button>
      </nav>

      {/* Zone 3: 1 primary action - Model Engine Selector */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenModelSettings}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-[#DDD5C9] hover:border-stone-400 rounded-md shadow-2xs transition-all whitespace-nowrap cursor-pointer"
          title="Configure AI model engine"
        >
          {getProviderIcon()}
          <span>{providerInfo.name}</span>
          <span className="text-stone-400">·</span>
          <span className="font-mono text-stone-500 truncate max-w-[100px]">{llmConfig.model}</span>
          <Settings className="w-3.5 h-3.5 text-stone-400 ml-1" />
        </button>
      </div>
    </header>
  );
};
