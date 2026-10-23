import React, { useState, useEffect } from 'react';
import { LLMConfig, ModelProvider } from '../types';
import { DEFAULT_CONFIGS, PROVIDER_LABELS } from '../utils/modelConfig';
import { X, Check, Server, Shield, Cpu, Sparkles, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (newConfig: LLMConfig) => void;
}

export const ModelSettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onSave }) => {
  const [provider, setProvider] = useState<ModelProvider>(config.provider);
  const [model, setModel] = useState<string>(config.model);
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [baseUrl, setBaseUrl] = useState<string>(config.baseUrl || DEFAULT_CONFIGS.ollama.defaultBaseUrl || 'http://127.0.0.1:11434');
  
  const [testStatus, setTestStatus] = useState<{ loading: boolean; ok?: boolean; message?: string }>({ loading: false });

  useEffect(() => {
    if (isOpen) {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey(config.apiKey || '');
      setBaseUrl(config.baseUrl || DEFAULT_CONFIGS.ollama.defaultBaseUrl || 'http://127.0.0.1:11434');
      setTestStatus({ loading: false });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleProviderChange = (p: ModelProvider) => {
    setProvider(p);
    setModel(DEFAULT_CONFIGS[p].model);
    setTestStatus({ loading: false });
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const resp = await fetch('/api/llm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });
      const data = await resp.json();
      setTestStatus({
        loading: false,
        ok: data.ok,
        message: data.message,
      });
    } catch (err: any) {
      setTestStatus({
        loading: false,
        ok: false,
        message: err.message || 'Network test failed.',
      });
    }
  };

  const handleSave = () => {
    onSave({
      provider,
      model: model.trim() || DEFAULT_CONFIGS[provider].model,
      apiKey: apiKey.trim() || undefined,
      baseUrl: provider === 'ollama' ? (baseUrl.trim() || DEFAULT_CONFIGS.ollama.defaultBaseUrl) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#FAF7F2] border border-[#E2DBD0] rounded-xl shadow-xl overflow-hidden flex flex-col text-stone-800">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D7] bg-[#F4EFEA]">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Intelligence Provider</h2>
            <p className="text-xs text-stone-500 mt-0.5">Select and configure your preferred AI model engine</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Provider Grid */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Model Engine
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['ollama', 'groq', 'gemini', 'openai'] as ModelProvider[]).map((p) => {
                const isSelected = provider === p;
                const info = PROVIDER_LABELS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderChange(p)}
                    className={`flex flex-col items-start p-3 text-left rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[#C85A32] bg-[#FBF5F1] shadow-xs'
                        : 'border-[#E5DFD4] bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-medium text-stone-900 flex items-center gap-1.5">
                        {p === 'ollama' && <Server className="w-3.5 h-3.5 text-stone-600" />}
                        {p === 'groq' && <Cpu className="w-3.5 h-3.5 text-stone-600" />}
                        {p === 'gemini' && <Sparkles className="w-3.5 h-3.5 text-stone-600" />}
                        {p === 'openai' && <Shield className="w-3.5 h-3.5 text-stone-600" />}
                        {info.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#C85A32]" />}
                    </div>
                    <span className="text-[11px] text-[#A64A26] font-medium mt-1">{info.tag}</span>
                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">{info.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Name Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Model Identifier
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_CONFIGS[provider].model}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E2DBD0] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors font-mono"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              {provider === 'ollama' && 'E.g. llama3.2, mistral, deepseek-r1, qwen2.5'}
              {provider === 'groq' && 'E.g. llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768'}
              {provider === 'openai' && 'E.g. gpt-4o-mini, gpt-4o, gpt-4-turbo'}
              {provider === 'gemini' && 'E.g. gemini-3.8-flash, gemini-3.1-flash-lite'}
            </p>
          </div>

          {/* Provider Specific Settings */}
          {provider === 'ollama' ? (
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Local Ollama Host URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DBD0] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors font-mono"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Make sure Ollama is running locally (<code className="text-stone-700">ollama serve</code>).
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                API Key {provider === 'gemini' ? '(Optional: uses server key by default)' : '(Optional if set in .env)'}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter custom API key if not in .env..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#E2DBD0] rounded-md focus:outline-none focus:border-[#C85A32] transition-colors font-mono"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Keys can also be configured securely in the root <code className="text-stone-700 font-mono">.env</code> file.
              </p>
            </div>
          )}

          {/* Test Status Feedback */}
          {testStatus.message && (
            <div
              className={`p-3 rounded-md text-xs flex items-start gap-2 ${
                testStatus.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {testStatus.ok ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E8E2D7] bg-[#F4EFEA]">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus.loading}
            className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            {testStatus.loading ? 'Testing...' : 'Test Connection'}
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#C85A32] hover:bg-[#AA4A24] rounded-md shadow-xs transition-colors"
            >
              Apply Selection
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
