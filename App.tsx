import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Wand2, RefreshCw, FileText, Download, AlertCircle, Sparkles, Key, Scissors, RotateCcw, AlertTriangle, LogOut } from 'lucide-react';
import OutfitSelector from './components/OutfitSelector';
import ApiKeyChecker from './components/ApiKeyChecker';
import LoginScreen from './components/LoginScreen';
import { fileToBase64, getImageDimensions, getDisplayUrl } from './utils';
import { analyzeAndCreatePrompt, generateOutfitImage, analyzeAndCreateExtractionPrompt, analyzeReferenceOutfit, verifyOutfitMatch } from './services/gemini';
import { AppState, AspectRatio, ModelTier } from './types';
import { subscribeToAuthChanges, logOut } from './services/firebase';
import { User } from 'firebase/auth';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // API Key State
  const [apiKey, setApiKey] = useState<string | null>(null);

  // App State
  const [appState, setAppState] = useState<AppState>('idle');

  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [modelTier, setModelTier] = useState<ModelTier>('pro');

  // Outfit State
  const [outfitMode, setOutfitMode] = useState<'text' | 'image'>('text');
  const [targetOutfitText, setTargetOutfitText] = useState<string>('');
  const [refOutfitImage, setRefOutfitImage] = useState<File | null>(null);

  const [yamlAnalysis, setYamlAnalysis] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Track the last successful action and prompt for Retry functionality
  const [lastAction, setLastAction] = useState<'generate' | 'extract' | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // File Upload Handlers
  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage("画像ファイルのみアップロード可能です。");
      return;
    }
    setErrorMessage(null);
    setWarningMessage(null);
    setSourceImage(file);
    setSourceImageUrl(getDisplayUrl(file));
    setGeneratedImageUrl(null);
    setYamlAnalysis('');
    setAppState('idle');
    setLastAction(null);
    setLastPrompt(null);

    // Determine Aspect Ratio
    const dims = await getImageDimensions(file);
    setAspectRatio(dims.aspectRatio);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Main Logic - Outfit Change
  const handleGenerate = async () => {
    if (!sourceImage || !apiKey) return;
    if (outfitMode === 'text' && !targetOutfitText) return;
    if (outfitMode === 'image' && !refOutfitImage) return;

    setLastAction('generate');
    setAppState('analyzing');
    setErrorMessage(null);
    setWarningMessage(null);
    setYamlAnalysis('');
    setLastPrompt(null);

    try {
      const sourceBase64 = await fileToBase64(sourceImage);
      let finalTargetOutfit = targetOutfitText;

      // Special Flow for Reference Image
      if (outfitMode === 'image' && refOutfitImage) {
        setAppState('analyzing'); // Still analyzing phase
        const refBase64 = await fileToBase64(refOutfitImage);

        // Analyze reference image to get keywords
        finalTargetOutfit = await analyzeReferenceOutfit(apiKey, refBase64, modelTier);

        // Validation: Check if we got valid data
        if (!finalTargetOutfit || finalTargetOutfit.trim() === '') {
          throw new Error("リファレンスからデータ取得できませんでした。もう一度お試しください。");
        }

        setYamlAnalysis(`Reference Analysis:\n${finalTargetOutfit}\n\n(Proceeding to Character Analysis...)`);
      }

      // Step 1: Analyze Character and Create Prompt
      const { yaml, prompt } = await analyzeAndCreatePrompt(apiKey, sourceBase64, finalTargetOutfit, modelTier);

      // Store the prompt for retry
      setLastPrompt(prompt);

      // Append YAML if we had previous reference analysis
      setYamlAnalysis(prev => prev ? `${prev}\n\n${yaml}` : yaml);

      setAppState('generating');

      // Step 2: Generate Image (Image-to-Image)
      const imageUrl = await generateOutfitImage(apiKey, sourceBase64, prompt, aspectRatio);
      setGeneratedImageUrl(imageUrl);
      setAppState('complete');

      // Step 3: Verify Result (Async)
      // Extract pure Base64 for verification
      const base64Data = imageUrl.split(',')[1];
      verifyOutfitMatch(apiKey, base64Data, finalTargetOutfit, modelTier).then(result => {
        if (!result.match) {
          setWarningMessage(`生成された画像が指定された服装と異なる可能性があります。\n理由: ${result.reason}`);
        }
      });

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "予期せぬエラーが発生しました。");
      setAppState('error');
    }
  };

  // Logic - Extraction (Background Removal)
  const handleExtract = async () => {
    if (!sourceImage || !apiKey) return;

    setLastAction('extract');
    setAppState('analyzing');
    setErrorMessage(null);
    setWarningMessage(null);
    setYamlAnalysis('');
    setLastPrompt(null);

    try {
      const base64 = await fileToBase64(sourceImage);

      // Step 1: Analyze and Create Prompt for Extraction
      const { yaml, prompt } = await analyzeAndCreateExtractionPrompt(apiKey, base64, modelTier);

      // Store the prompt for retry
      setLastPrompt(prompt);

      setYamlAnalysis(yaml);
      setAppState('generating');

      // Step 2: Generate Image using the extraction prompt
      const imageUrl = await generateOutfitImage(apiKey, base64, prompt, aspectRatio);
      setGeneratedImageUrl(imageUrl);
      setAppState('complete');

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "予期せぬエラーが発生しました。");
      setAppState('error');
    }
  };

  const handleRetry = async () => {
    if (!sourceImage || !lastPrompt || !apiKey) return;

    setAppState('generating');
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const sourceBase64 = await fileToBase64(sourceImage);

      // Reuse the stored prompt directly
      const imageUrl = await generateOutfitImage(apiKey, sourceBase64, lastPrompt, aspectRatio);

      setGeneratedImageUrl(imageUrl);
      setAppState('complete');

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "再生成中にエラーが発生しました。");
      setAppState('error');
    }
  };

  const reset = () => {
    setSourceImage(null);
    setSourceImageUrl(null);
    setGeneratedImageUrl(null);
    setYamlAnalysis('');
    setTargetOutfitText('');
    setRefOutfitImage(null);
    setAppState('idle');
    setLastAction(null);
    setLastPrompt(null);
    setWarningMessage(null);
  };

  const handleLogout = async () => {
    await logOut();
    setUser(null);
    // Optional: Clear API key on logout?
    // setApiKey(null); 
  };

  const handleChangeKey = () => {
    // Force ApiKeyChecker to show by clearing the key state
    // Note: It will re-read from localStorage, so we might need to clear localStorage too if we want to force re-entry
    // But usually "Change Key" implies re-entering.
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey(null);
  };

  // Validation helper
  const isGenerateDisabled = () => {
    if (!sourceImage) return true;
    if (appState === 'analyzing' || appState === 'generating') return true;
    if (!apiKey) return true;

    if (outfitMode === 'text') return !targetOutfitText;
    if (outfitMode === 'image') return !refOutfitImage;

    return true;
  };

  // Render Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Render Login
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      {!apiKey && <ApiKeyChecker onReady={setApiKey} />}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="text-purple-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CostumeChange Pro
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Model Selector */}
            <select
              value={modelTier}
              onChange={(e) => setModelTier(e.target.value as ModelTier)}
              className="bg-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-purple-500 hidden sm:block"
            >
              <option value="pro">Pro (High Quality)</option>
              <option value="flash">Flash (Fast/Free)</option>
            </select>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-slate-300 hidden sm:block">{user.displayName || user.email}</span>
              <button
                onClick={handleChangeKey}
                className="p-1 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white mr-1"
                title="APIキーを変更"
              >
                <Key size={14} />
              </button>
              <button
                onClick={handleLogout}
                className="p-1 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
                title="ログアウト"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Only show if API Key is ready (or let ApiKeyChecker block it) */}
      {/* We use a blur effect if API key is missing to show context but block interaction */}
      <main className={`flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-500 ${!apiKey ? 'blur-sm pointer-events-none opacity-50' : ''}`}>

        {/* LEFT PANEL: Upload & Input (Span 4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">

          {/* Upload Area */}
          <div
            className={`
              relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed transition-all overflow-hidden
              ${sourceImage ? 'border-purple-500/50 bg-slate-900/50' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 cursor-pointer'}
            `}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => !sourceImage && fileInputRef.current?.click()}
          >
            {sourceImageUrl ? (
              <>
                <img
                  src={sourceImageUrl}
                  alt="Upload"
                  className="absolute inset-0 w-full h-full object-contain p-2"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/60 rounded text-xs font-mono text-white/80">
                  比率: {aspectRatio}
                </div>
              </>
            ) : (
              <div className="text-center p-6 pointer-events-none">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400">
                  <Upload size={32} />
                </div>
                <p className="text-sm font-medium text-slate-300">画像をドロップ</p>
                <p className="text-xs text-slate-500 mt-1">またはクリックして選択</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
          </div>

          {/* Outfit Control Panel */}
          <div className="flex-1 min-h-[400px] flex flex-col">
            <OutfitSelector
              selectedOutfit={targetOutfitText}
              onOutfitChange={setTargetOutfitText}
              refImage={refOutfitImage}
              onRefImageChange={setRefOutfitImage}
              mode={outfitMode}
              onModeChange={setOutfitMode}
              disabled={appState === 'analyzing' || appState === 'generating'}
            />

            <div className="mt-4 flex flex-col gap-3">
              <button
                onClick={handleGenerate}
                disabled={isGenerateDisabled()}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                  ${isGenerateDisabled()
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transform hover:scale-[1.02]'
                  }
                `}
              >
                {appState === 'analyzing' || appState === 'generating' ? (
                  <>
                    <RefreshCw className="animate-spin" /> 処理中...
                  </>
                ) : (
                  <>
                    <Wand2 /> 服装チェンジ！
                  </>
                )}
              </button>

              <button
                onClick={handleExtract}
                disabled={!sourceImage || appState === 'analyzing' || appState === 'generating' || !apiKey}
                className={`
                  w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all border
                  ${(!sourceImage)
                    ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transform hover:scale-[1.01]'
                  }
                `}
              >
                <Scissors size={18} /> キャラ抜き出し！
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Output & Analysis (Span 8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-6">

          {/* Result View */}
          <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 p-1 flex items-center justify-center min-h-[400px] relative overflow-hidden group">
            {generatedImageUrl ? (
              <>
                <img
                  src={generatedImageUrl}
                  alt="Generated Result"
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                />

                {/* ACTION BUTTONS */}
                <div className="absolute bottom-6 right-6 flex items-center gap-3">
                  {/* RETRY BUTTON */}
                  {lastAction && lastPrompt && (
                    <button
                      onClick={handleRetry}
                      disabled={appState === 'analyzing' || appState === 'generating'}
                      className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 border border-slate-600 backdrop-blur-sm"
                    >
                      <RotateCcw size={18} className={appState === 'analyzing' || appState === 'generating' ? "animate-spin" : ""} />
                      <span className="text-sm font-bold">もう一回</span>
                    </button>
                  )}

                  {/* DOWNLOAD BUTTON */}
                  <a
                    href={generatedImageUrl}
                    download="costume-change.png"
                    className="p-3 bg-purple-600/90 rounded-full shadow-xl hover:bg-purple-500 transition-transform hover:scale-110 flex items-center justify-center text-white backdrop-blur-sm"
                    title="ダウンロード"
                  >
                    <Download size={24} />
                  </a>
                </div>
              </>
            ) : appState === 'analyzing' || appState === 'generating' ? (
              <div className="flex flex-col items-center justify-center text-slate-400 animate-pulse">
                <div className="w-24 h-24 rounded-full bg-slate-800 mb-4 flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
                  <Wand2 className="text-purple-500/50" size={40} />
                </div>
                <p className="text-lg font-light">
                  {appState === 'analyzing' ? '特徴を解析中...' : '画像を生成中...'}
                </p>
                <p className="text-xs text-slate-600 mt-2">Gemini 3 Proが頑張っています</p>
              </div>
            ) : (
              <div className="text-slate-600 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 mb-4 flex items-center justify-center">
                  <Sparkles size={32} className="opacity-50" />
                </div>
                <p>ここに生成結果が表示されます</p>
              </div>
            )}
          </div>

          {/* Warning Message (Validation Failure) */}
          {warningMessage && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col gap-2 text-yellow-400">
              <div className="flex items-center gap-3 font-bold">
                <AlertTriangle size={20} />
                <span>生成結果の確認</span>
              </div>
              <p className="text-sm text-yellow-200/80 whitespace-pre-line ml-8">
                {warningMessage}
              </p>
            </div>
          )}

          {/* YAML Analysis Display (Bottom) */}
          {yamlAnalysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <FileText size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">解析データ (YAML)</span>
              </div>
              <div className="bg-black/30 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800/50 h-40 overflow-y-auto custom-scrollbar">
                {yamlAnalysis}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-3 text-red-400">
              <div className="flex items-center gap-3">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
              {(errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) && (
                <button
                  onClick={handleChangeKey}
                  className="self-start px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 text-red-300 border border-red-500/30"
                >
                  <Key size={14} />
                  APIキーを変更・再接続
                </button>
              )}
            </div>
          )}

        </section>
      </main>
    </div>
  );
};

export default App;