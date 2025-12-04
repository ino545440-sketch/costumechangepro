import React, { useEffect, useState } from 'react';
import { Key, Save, ExternalLink } from 'lucide-react';

interface ApiKeyCheckerProps {
  onReady: (key: string) => void;
}

const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onReady }) => {
  const [inputKey, setInputKey] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1. Check LocalStorage
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) {
      onReady(storedKey);
      setIsVisible(false);
      return;
    }

    // 2. Check Environment Variable (for dev/build time injection)
    // Note: In Vite, process.env is replaced by define, but we can also check import.meta.env
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env.GEMINI_API_KEY as string);
    if (envKey && envKey.length > 10) { // Simple validation
      onReady(envKey);
      setIsVisible(false);
      return;
    }

    // 3. Check AI Studio (Legacy/Extension support)
    const checkAIStudio = async () => {
      try {
        const aistudio = (window as any).aistudio;
        if (aistudio && await aistudio.hasSelectedApiKey()) {
          // If AI Studio has a key, we might not be able to extract it directly depending on the API.
          // But if the original code relied on it injecting it into the environment or intercepting calls,
          // we might need to handle it differently.
          // For now, if we are in AI Studio, we assume it handles auth or we prompt user to copy it.
          // Since we refactored gemini.ts to REQUIRE a key string, we can't just "be ready".
          // We'll skip this implicit check for the web version to ensure we get a string.
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkAIStudio();

  }, [onReady]);

  const handleSave = (key: string) => {
    if (!key.trim()) return;

    // Basic validation
    if (!key.startsWith('AIza')) {
      alert("有効なGemini APIキーではないようです（AIzaから始まります）。");
      return;
    }

    localStorage.setItem('GEMINI_API_KEY', key);
    onReady(key);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>

        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-400 shadow-inner">
          <Key size={32} />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">APIキーの設定</h2>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed">
          このアプリを利用するには、Google Gemini APIキーが必要です。<br />
          キーはブラウザ内にのみ保存され、外部に送信されることはありません。
        </p>

        <div className="flex flex-col gap-4 text-left">
          {/* AI Studio Select Button (Hybrid) */}
          <button
            onClick={async () => {
              try {
                const aistudio = (window as any).aistudio;
                if (!aistudio) {
                  alert("この機能はGoogle AI Studio環境、または対応する拡張機能が必要です。\n通常のWebブラウザでは下のフォームから手動で入力してください。");
                  return;
                }
                // Try to get key from AI Studio interface
                const key = await aistudio.openSelectKey();
                // Note: openSelectKey might return void if it just sets internal state, 
                // but if the user insists on "import", we hope it returns the key string.
                // If it returns null/void, we can't support it with the current architecture.
                if (key && typeof key === 'string') {
                  handleSave(key);
                } else {
                  // Fallback if it doesn't return the key string directly
                  alert("キーの自動取得に失敗しました（環境が対応していない可能性があります）。\n手動で入力してください。");
                }
              } catch (e) {
                console.error(e);
                alert("エラーが発生しました。手動入力をご利用ください。");
              }
            }}
            className="w-full bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm mb-2"
          >
            <img src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg" alt="Google" className="h-5" />
            <span>Googleアカウントからキーを選択</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">または</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Gemini API Key (手動入力)</label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm transition-all"
            />
          </div>

          <button
            onClick={() => handleSave(inputKey)}
            disabled={!inputKey}
            className={`
              w-full font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg
              ${inputKey
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transform hover:scale-[1.02]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
            `}
          >
            <Save size={18} />
            保存して開始
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <span>APIキーを無料で取得する</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyChecker;