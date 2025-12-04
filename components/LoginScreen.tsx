import React, { useState } from 'react';
import { signInWithGoogle } from '../services/firebase';
import { LogIn, AlertCircle } from 'lucide-react';

const LoginScreen: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (e: any) {
            console.error(e);
            if (e.code === 'auth/configuration-not-found' || e.code === 'auth/api-key-not-valid-please-pass-a-valid-api-key') {
                setError("Firebaseの設定が正しくありません。管理者に連絡するか、環境変数を設定してください。");
            } else {
                setError("ログインに失敗しました。もう一度お試しください。");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <LogIn size={40} className="text-white" />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">CostumeChange Pro</h1>
                <p className="text-slate-400 mb-8">
                    AIで自由自在に衣装チェンジ。<br />
                    利用するにはGoogleアカウントでログインしてください。
                </p>

                {error && (
                    <div className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-400 text-sm text-left">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg transform hover:scale-[1.02]"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    )}
                    <span>Googleでログイン</span>
                </button>

                <p className="mt-6 text-xs text-slate-600">
                    Powered by Gemini Nano Banana Pro
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
