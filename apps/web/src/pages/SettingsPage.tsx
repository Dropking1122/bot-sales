import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { QrCode, Wifi, WifiOff, RefreshCw, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  // WhatsApp State
  const [waStatus, setWaStatus] = useState<any | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waActionLoading, setWaActionLoading] = useState(false);

  // Bot Settings State
  const [settings, setSettings] = useState<Record<string, string>>({
    bot_greeting: '',
    bot_operating_hours: '',
    bot_dealer_address: '',
    bot_dealer_phone: '',
    bot_auto_reply: 'true',
    broadcast_speed_limit: 'conservative'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadWaStatus = async () => {
    try {
      const res = await apiRequest('/whatsapp/status');
      if (res.success) {
        setWaStatus(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setWaLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await apiRequest('/settings');
      if (res.success) {
        const mapped: Record<string, string> = {};
        res.data.forEach((s: any) => {
          mapped[s.key] = s.value;
        });
        setSettings((prev) => ({ ...prev, ...mapped }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadWaStatus();
    loadSettings();

    const interval = setInterval(loadWaStatus, 3000); // 3s polling for QR updates
    return () => clearInterval(interval);
  }, []);

  const handleWaAction = async (action: 'connect' | 'disconnect' | 'reconnect') => {
    setWaActionLoading(true);
    try {
      await apiRequest(`/whatsapp/${action}`, { method: 'POST' });
      await loadWaStatus();
    } catch (err: any) {
      alert(err.message || `Gagal melakukan aksi ${action}`);
    } finally {
      setWaActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSavedSuccess(false);

    try {
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pengaturan Sistem & WhatsApp Bot
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelola sesi koneksi WhatsApp Web, template sapaan bot, serta data operasional dealer
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Connection Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <span>Koneksi WhatsApp Web</span>
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                waStatus?.status === 'CONNECTED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : waStatus?.status === 'QR_READY'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {waStatus?.status || 'DISCONNECTED'}
            </span>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 min-h-[280px]">
            {waStatus?.status === 'CONNECTED' ? (
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  WhatsApp Bot Terhubung Aktif
                </p>
                <p className="text-xs text-slate-500">
                  Bot siap merespons pesan pelanggan & memproses antrean broadcast.
                </p>
              </div>
            ) : (waStatus?.qrCode || waStatus?.qrImage) ? (
              <div className="text-center space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-md inline-block border border-slate-200 dark:border-slate-700">
                  <img
                    src={waStatus?.qrCode || waStatus?.qrImage}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56 rounded-lg block mx-auto"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Buka WhatsApp di Ponsel Anda
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Menu Titik Tiga / Pengaturan &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; Pindai QR di atas
                  </p>
                </div>
              </div>
            ) : waStatus?.status === 'INITIALIZING' || waActionLoading ? (
              <div className="text-center space-y-3 text-slate-400">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sedang Memulai Browser WhatsApp...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Menghubungkan Chrome & menyiapkan QR Code baru (~5-10 detik)
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 text-slate-400">
                <WifiOff className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs text-slate-500">
                  WhatsApp belum terhubung. Klik tombol di bawah untuk menampilkan QR Code.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {waStatus?.status === 'CONNECTED' ? (
              <button
                disabled={waActionLoading}
                onClick={() => handleWaAction('disconnect')}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Putuskan Koneksi WhatsApp
              </button>
            ) : (
              <button
                disabled={waActionLoading}
                onClick={() => handleWaAction('connect')}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {waActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Mulai & Tampilkan QR WhatsApp</span>
              </button>
            )}

            <button
              disabled={waActionLoading}
              onClick={() => handleWaAction('reconnect')}
              title="Hubungkan Ulang"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bot General Settings Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Konfigurasi Balasan & Identitas Dealer
            </h2>
            <p className="text-xs text-slate-500">
              Data yang dikirimkan secara otomatis oleh WhatsApp bot kepada pelanggan
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pesan Sapaan Otomatis (Greeting)
              </label>
              <textarea
                rows={3}
                value={settings.bot_greeting}
                onChange={(e) => setSettings({ ...settings, bot_greeting: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jam Operasional Dealer
              </label>
              <input
                type="text"
                value={settings.bot_operating_hours}
                onChange={(e) => setSettings({ ...settings, bot_operating_hours: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alamat Dealer
              </label>
              <input
                type="text"
                value={settings.bot_dealer_address}
                onChange={(e) => setSettings({ ...settings, bot_dealer_address: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nomor Telepon Hotline / CS
              </label>
              <input
                type="text"
                value={settings.bot_dealer_phone}
                onChange={(e) => setSettings({ ...settings, bot_dealer_phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Pengaturan berhasil disimpan!
                </span>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
