import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { AutomotiveLogo } from '../components/ui/AutomotiveLogo';
import { Shield, KeyRound, Lock, AlertCircle, Loader2, CheckCircle2, ChevronRight, X } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [passkey, setPasskey] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Automatic Authorization via Secret URL Parameter (?key=...)
  useEffect(() => {
    const autoKey = searchParams.get('key');
    if (autoKey) {
      handlePasskeyAuth(autoKey);
    }
  }, [searchParams]);

  const handlePasskeyAuth = async (keyToVerify: string) => {
    if (!keyToVerify.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest('/auth/passkey', {
        method: 'POST',
        body: JSON.stringify({ passkey: keyToVerify.trim() })
      });

      if (res.success && res.data) {
        login(res.data.token, res.data.user);
        navigate('/');
      } else {
        setError(res.message || 'Kunci otorisasi tidak valid');
      }
    } catch (err: any) {
      setError(err.message || 'Otorisasi gagal atau akses ditolak');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePasskeyAuth(passkey);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-12 relative overflow-hidden font-sans">
      {/* Background subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Restricted Card - NO open form fields */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-6 relative z-10">
        {/* Header with Automotive Insignia */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
            <AutomotiveLogo className="w-10 h-10" size={40} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase tracking-wider">
              Dealer Management System
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Terminal Operasional Ritel & Konsol Otomotif
            </p>
          </div>
        </div>

        {/* Corporate Status Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              TERMINAL: ONLINE
            </span>
            <span>SECURE GATEWAY</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Akses portal dibatasi secara eksklusif untuk terminal konsol resmi dealer. Semua sesi koneksi diverifikasi secara terenkripsi.
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-center gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action: Discreet Authorization Trigger */}
        <div className="pt-2">
          {loading ? (
            <div className="w-full py-3 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Memvalidasi Kredensial Konsol...</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setError(null);
                setShowPrompt(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 hover:border-slate-600 font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-blue-400" />
              <span>Otorisasi Akses Terminal</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
            </button>
          )}
        </div>

        {/* Footer Audit Notice */}
        <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-400 font-mono">
          INTERNAL AUDIT ID: 8821-DMS • ZERO EXTERNAL EXPOSURE
        </div>
      </div>

      {/* Discrete Passkey Prompt Modal */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Lock className="w-4 h-4 text-blue-400" />
                <span>Otorisasi Konsol Dealer</span>
              </div>
              <button
                onClick={() => setShowPrompt(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Masukkan Kunci Otorisasi Konsol (Master Passkey):
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="password"
                autoFocus
                required
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-center tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrompt(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || !passkey.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Verifikasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
