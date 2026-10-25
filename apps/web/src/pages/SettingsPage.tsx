import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { AutomotiveLogo } from '../components/ui/AutomotiveLogo';
import {
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Image as ImageIcon,
  Upload,
  Trash2,
  Building2,
  Bot,
  ExternalLink,
  Sparkles,
  Key,
  Cpu,
  Eye,
  EyeOff,
  Play
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings: globalSettings, refreshSettings, updateSettingsState } = useSettings();
  const [activeTab, setActiveTab] = useState<'web' | 'whatsapp' | 'bot' | 'ai'>('web');

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<any | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waActionLoading, setWaActionLoading] = useState(false);

  // Form Settings State
  const [settings, setSettings] = useState<Record<string, string>>({
    web_title: '',
    web_brand_name: '',
    web_brand_sub: '',
    web_logo_url: '',
    web_favicon_url: '',
    web_meta_description: '',
    web_meta_keywords: '',
    web_footer_copyright: '',
    bot_greeting: '',
    bot_operating_hours: '',
    bot_dealer_address: '',
    bot_dealer_phone: '',
    bot_auto_reply: 'true',
    broadcast_speed_limit: 'conservative',
    ai_agent_enabled: 'true',
    ai_provider_url: 'http://127.0.0.1:20128/v1',
    ai_api_key: '',
    ai_model: 'antigravity',
    ai_system_prompt: '',
    ai_temperature: '0.7',
    ai_max_tokens: '400'
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testAiLoading, setTestAiLoading] = useState(false);
  const [testAiResponse, setTestAiResponse] = useState<string | null>(null);
  const [testAiError, setTestAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (res.success && Array.isArray(res.data)) {
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

    const interval = setInterval(loadWaStatus, 3000);
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

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSavedSuccess(false);

    try {
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings })
      });
      // Synchronize frontend context in real time
      updateSettingsState(settings);
      await refreshSettings();

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestAi = async () => {
    setTestAiLoading(true);
    setTestAiResponse(null);
    setTestAiError(null);

    try {
      const res = await apiRequest('/settings/test-ai', {
        method: 'POST',
        body: JSON.stringify({
          providerUrl: settings.ai_provider_url,
          apiKey: settings.ai_api_key,
          model: settings.ai_model,
          systemPrompt: settings.ai_system_prompt
        })
      });

      if (res.success && res.reply) {
        setTestAiResponse(res.reply);
      } else {
        setTestAiError(res.error || 'Gagal menerima balasan dari AI');
      }
    } catch (err: any) {
      setTestAiError(err.message || 'Gagal menghubungi endpoint tes AI');
    } finally {
      setTestAiLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await apiRequest('/settings/logo', {
        method: 'POST',
        body: formData
      });
      if (res.success && res.data?.url) {
        setSettings((prev) => ({ ...prev, web_logo_url: res.data.url }));
        updateSettingsState({ web_logo_url: res.data.url });
      } else {
        alert(res.message || 'Gagal mengunggah logo');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat unggah logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pengaturan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Konfigurasi logo, judul web, meta tags, koneksi WhatsApp gateway, dan profil operasional dealer
          </p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={savingSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors shrink-0 self-start sm:self-auto"
        >
          {savingSettings ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : savedSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{savedSuccess ? 'Tersimpan!' : savingSettings ? 'Menyimpan...' : 'Simpan Semua'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('web')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'web'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Identitas & Tampilan Web</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'whatsapp'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>WhatsApp Gateway</span>
          <span
            className={`w-2 h-2 rounded-full ${
              waStatus?.status === 'CONNECTED'
                ? 'bg-emerald-500'
                : waStatus?.status === 'QR_READY'
                ? 'bg-amber-500 animate-ping'
                : 'bg-slate-400'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'bot'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Profil Dealer & Bot</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'ai'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>AI Agent (9router / LLM)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              settings.ai_agent_enabled === 'true' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </button>
      </div>

      {/* Success Notification Bar */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Pengaturan berhasil disimpan dan langsung diterapkan ke seluruh sistem!</span>
        </div>
      )}

      {/* TAB 1: IDENTITAS & TAMPILAN WEB */}
      {activeTab === 'web' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <span>Pengaturan Logo & Branding</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Kustomisasi logo yang tampil di navbar sidebar, kartu login, serta favicon peramban
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Logo Preview */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center text-center space-y-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Pratinjau Logo Saat Ini
                </div>
                <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-3 shadow-inner overflow-hidden">
                  {settings.web_logo_url ? (
                    <img
                      src={settings.web_logo_url}
                      alt="Current Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <AutomotiveLogo className="w-12 h-12 text-blue-600 dark:text-blue-400" size={48} />
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {settings.web_logo_url ? 'Menggunakan Logo Kustom' : 'Menggunakan Lambang Otomotif Bawaan'}
                </div>

                {settings.web_logo_url && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, web_logo_url: '' }));
                      updateSettingsState({ web_logo_url: '' });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-medium pt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset ke Logo Bawaan</span>
                  </button>
                )}
              </div>

              {/* Logo Inputs & Upload */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Unggah Berkas Gambar Logo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      id="logo-upload-input"
                    />
                    <label
                      htmlFor="logo-upload-input"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <Upload className="w-4 h-4 text-blue-600" />
                      )}
                      <span>{uploadingLogo ? 'Mengunggah...' : 'Pilih Berkas Logo (PNG/JPG/SVG/WEBP)'}</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Rekomendasi rasio 1:1 (persegi) atau horizontal proporsional dengan latar transparan.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Atau Masukkan URL Gambar Logo Langsung
                  </label>
                  <input
                    type="text"
                    value={settings.web_logo_url || ''}
                    onChange={(e) => setSettings({ ...settings, web_logo_url: e.target.value })}
                    placeholder="https://domain.com/logo.png atau /storage/uploads/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    URL Favicon Tab Browser (Opsional)
                  </label>
                  <input
                    type="text"
                    value={settings.web_favicon_url || ''}
                    onChange={(e) => setSettings({ ...settings, web_favicon_url: e.target.value })}
                    placeholder="/favicon.ico atau https://domain.com/favicon.png"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Judul & Nama Brand */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>Judul Halaman & Identitas Web</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atur judul tab peramban, nama aplikasi di bilah samping, serta teks hak cipta footer
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Title Web (Judul Tab Browser)
                </label>
                <input
                  type="text"
                  value={settings.web_title || ''}
                  onChange={(e) => setSettings({ ...settings, web_title: e.target.value })}
                  placeholder="DMS — Dealer Management System | REVDSTORE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tampil pada bilah tab peramban dan penanda riwayat browser pengguna.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Web / Nama Brand (Sidebar & Login Header)
                </label>
                <input
                  type="text"
                  value={settings.web_brand_name || ''}
                  onChange={(e) => setSettings({ ...settings, web_brand_name: e.target.value })}
                  placeholder="REVDSTORE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama utama brand yang tampil di pojok kiri atas dan header kartu otentikasi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sub-Judul Brand (Deskripsi Ringkas Sidebar)
                </label>
                <input
                  type="text"
                  value={settings.web_brand_sub || ''}
                  onChange={(e) => setSettings({ ...settings, web_brand_sub: e.target.value })}
                  placeholder="Dealer Retail Console"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Sub-teks kecil di bawah nama brand pada navigasi samping.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Copyright Footer (Teks Hak Cipta)
                </label>
                <input
                  type="text"
                  value={settings.web_footer_copyright || ''}
                  onChange={(e) => setSettings({ ...settings, web_footer_copyright: e.target.value })}
                  placeholder="REVDSTORE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Teks nama pemilik hak cipta di bagian footer dashboard dan form login.
                </p>
              </div>
            </div>
          </div>

          {/* Meta Tags & SEO */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>Pengaturan Meta Tags & SEO</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Kustomisasi tag meta HTML untuk optimasi mesin telusur dan cuplikan tautan sosial media
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Meta Description (Deskripsi Meta Web)
                </label>
                <textarea
                  rows={3}
                  value={settings.web_meta_description || ''}
                  onChange={(e) => setSettings({ ...settings, web_meta_description: e.target.value })}
                  placeholder="Platform Dealer Management System terpadu untuk penjualan motor, bot WhatsApp, dan analitik dealer."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Disematkan pada tag &lt;meta name="description"&gt; dan OpenGraph preview.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Meta Keywords (Kata Kunci Pencarian)
                </label>
                <input
                  type="text"
                  value={settings.web_meta_keywords || ''}
                  onChange={(e) => setSettings({ ...settings, web_meta_keywords: e.target.value })}
                  placeholder="dealer motor, dms, sales motor, bot whatsapp, kredit motor, revdstore"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pisahkan beberapa kata kunci menggunakan tanda koma.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHATSAPP GATEWAY */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  <span>Koneksi WhatsApp Gateway</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Hubungkan nomor WhatsApp resmi dealer menggunakan pemindaian kode QR
                </p>
              </div>
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
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 min-h-[320px]">
              {waStatus?.status === 'CONNECTED' ? (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      WhatsApp Gateway Terhubung Aktif
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Sesi bot berjalan stabil. Pesan masuk dari calon pembeli akan otomatis direspons dan kontak tersinkronisasi.
                    </p>
                  </div>
                </div>
              ) : (waStatus?.qrCode || waStatus?.qrImage) ? (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-white rounded-2xl shadow-lg inline-block border border-slate-200 dark:border-slate-700">
                    <img
                      src={waStatus?.qrCode || waStatus?.qrImage}
                      alt="QR Code WhatsApp"
                      className="w-60 h-60 rounded-lg block mx-auto"
                    />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pindai QR dengan Aplikasi WhatsApp
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; Arahkan kamera ke kode QR di atas.
                    </p>
                  </div>
                </div>
              ) : waStatus?.status === 'INITIALIZING' || waActionLoading ? (
                <div className="text-center space-y-3 text-slate-400">
                  <Loader2 className="w-9 h-9 mx-auto animate-spin text-blue-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Menyiapkan Mesin WhatsApp Web...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Menginisialisasi peramban Puppeteer dan membuat kode QR baru (~5-10 detik)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 text-slate-400">
                  <WifiOff className="w-10 h-10 mx-auto opacity-50" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      WhatsApp Belum Terhubung
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Klik tombol di bawah untuk mengaktifkan sesi WhatsApp dan memunculkan kode QR.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {waStatus?.status === 'CONNECTED' ? (
                <button
                  disabled={waActionLoading}
                  onClick={() => handleWaAction('disconnect')}
                  className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Putuskan Koneksi WhatsApp
                </button>
              ) : (
                <button
                  disabled={waActionLoading}
                  onClick={() => handleWaAction('connect')}
                  className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                >
                  {waActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{waStatus?.status === 'QR_READY' ? 'Refresh Kode QR' : 'Mulai / Hubungkan WhatsApp'}</span>
                </button>
              )}

              <button
                disabled={waActionLoading}
                onClick={() => handleWaAction('reconnect')}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${waActionLoading ? 'animate-spin' : ''}`} />
                <span>Restart Ulang Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI AGENT (9ROUTER / LLM) */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Main AI Configuration Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>Integrasi Agent AI WhatsApp</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Menjawab pertanyaan bebas calon pembeli secara cerdas, luwes, dan otomatis berbasis konteks katalog motor
                </p>
              </div>

              {/* Toggle Enable */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {settings.ai_agent_enabled === 'true' ? 'AI Aktif' : 'AI Nonaktif'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ai_agent_enabled: settings.ai_agent_enabled === 'true' ? 'false' : 'true'
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    settings.ai_agent_enabled === 'true' ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.ai_agent_enabled === 'true' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Pilihan Cepat Provider AI:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ai_provider_url: 'http://127.0.0.1:20128/v1',
                      ai_model: 'antigravity'
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/80 dark:hover:bg-blue-900 dark:text-blue-200 text-xs font-medium transition-colors"
                >
                  ⚡ 9router Lokal VPS (Port 20128)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ai_provider_url: 'https://api.groq.com/openai/v1',
                      ai_model: 'llama-3.3-70b-versatile'
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  🚀 Groq Cloud (Super Fast)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      ai_provider_url: 'https://api.openai.com/v1',
                      ai_model: 'gpt-4o-mini'
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 dark:text-emerald-200 text-xs font-medium transition-colors"
                >
                  🤖 OpenAI Resmi (gpt-4o-mini)
                </button>
              </div>
            </div>

            {/* Provider URL & Model Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  AI Provider Base URL *
                </label>
                <input
                  type="text"
                  value={settings.ai_provider_url || ''}
                  onChange={(e) => setSettings({ ...settings, ai_provider_url: e.target.value })}
                  placeholder="http://127.0.0.1:20128/v1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Format kompatibel OpenAI. Gunakan <code className="text-blue-500">http://127.0.0.1:20128/v1</code> untuk 9router lokal VPS.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Model AI (ID Model) *
                </label>
                <input
                  type="text"
                  value={settings.ai_model || ''}
                  onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                  placeholder="antigravity"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Contoh: <code className="text-blue-500">antigravity</code>, <code className="text-blue-500">qoder</code>, <code className="text-blue-500">Sk/z-ai/glm-5.2:free</code>, <code className="text-blue-500">gpt-4o-mini</code>
                </span>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  API Key (Otorisasi 9router / Provider)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.ai_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })}
                    placeholder="Masukkan API Key (kosongkan jika menggunakan default environment server)"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  API Key disimpan terenkripsi di database. Jika dikosongkan, backend otomatis membaca key bawaan server.
                </span>
              </div>

              {/* Temperature & Max Tokens */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Temperatur Respons (Kreativitas)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1.5"
                  value={settings.ai_temperature || '0.7'}
                  onChange={(e) => setSettings({ ...settings, ai_temperature: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Nilai 0.3 - 0.7 direkomendasikan untuk jawaban sales faktual dan konsisten.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Maksimal Panjang Balasan (Tokens)
                </label>
                <input
                  type="number"
                  step="50"
                  min="100"
                  max="2000"
                  value={settings.ai_max_tokens || '400'}
                  onChange={(e) => setSettings({ ...settings, ai_max_tokens: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  400 tokens setara ± 200-250 kata (pas untuk balon chat WhatsApp agar tidak kepanjangan).
                </span>
              </div>

              {/* System Prompt */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Instruksi Sistem & Persona Sales AI (System Prompt)
                </label>
                <textarea
                  rows={5}
                  value={settings.ai_system_prompt || ''}
                  onChange={(e) => setSettings({ ...settings, ai_system_prompt: e.target.value })}
                  placeholder="Anda adalah Vina, konsultan sales dealer motor Honda yang ramah, sopan, dan persuasif. Berikan penjelasan singkat mengenai keunggulan motor, harga OTR, dan rekomendasi cicilan..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  💡 *Catatan:* Data seluruh motor (OTR, DP, CC), jam buka dealer, dan riwayat chat 6 pesan terakhir otomatis disuntikkan oleh sistem ke dalam prompt setiap kali pesan masuk.
                </span>
              </div>
            </div>
          </div>

          {/* Test AI Connection Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-500" />
                  <span>Uji Coba Koneksi AI Agent</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kirimkan prompt uji coba ke provider 9router untuk memastikan koneksi dan respon AI aktif dengan baik
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestAi}
                disabled={testAiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
              >
                {testAiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{testAiLoading ? 'Menghubungi AI...' : 'Tes Respons AI'}</span>
              </button>
            </div>

            {testAiError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <span className="font-semibold block">Gagal terhubung ke AI:</span>
                  <span className="font-mono text-[11px] break-all">{testAiError}</span>
                </div>
              </div>
            )}

            {testAiResponse && (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Koneksi Berhasil! Contoh Balasan dari Model:</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {testAiResponse}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'bot' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <span>Pengaturan Respon Otomatis Bot</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pesan sapaan otomatis dan aturan respon saat pelanggan mengirim pesan pertama
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Template Sapaan Otomatis (Greeting Message)
                </label>
                <textarea
                  rows={4}
                  value={settings.bot_greeting || ''}
                  onChange={(e) => setSettings({ ...settings, bot_greeting: e.target.value })}
                  placeholder="Halo! Selamat datang di Dealer Motor Resmi kami..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Respon Pesan Otomatis
                  </label>
                  <select
                    value={settings.bot_auto_reply || 'true'}
                    onChange={(e) => setSettings({ ...settings, bot_auto_reply: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  >
                    <option value="true">Aktif (Kirim balasan otomatis pada pesan baru)</option>
                    <option value="false">Nonaktif (Hanya gunakan bot untuk kirim broadcast manual)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kecepatan Pengiriman Broadcast
                  </label>
                  <select
                    value={settings.broadcast_speed_limit || 'conservative'}
                    onChange={(e) => setSettings({ ...settings, broadcast_speed_limit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  >
                    <option value="conservative">Konservatif (Aman: jeda acak 8-25 detik per pesan)</option>
                    <option value="moderate">Moderat (Jeda acak 5-15 detik per pesan)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Informasi Operasional Dealer</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Data kontak dan jam operasional yang disisipkan pada respon bot kepada pelanggan
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Jam Operasional Dealer
                </label>
                <input
                  type="text"
                  value={settings.bot_operating_hours || ''}
                  onChange={(e) => setSettings({ ...settings, bot_operating_hours: e.target.value })}
                  placeholder="Senin - Sabtu (08:30 - 17:00 WIB)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nomor Telepon Hotline / CS
                </label>
                <input
                  type="text"
                  value={settings.bot_dealer_phone || ''}
                  onChange={(e) => setSettings({ ...settings, bot_dealer_phone: e.target.value })}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alamat Showroom & Bengkel Dealer
                </label>
                <input
                  type="text"
                  value={settings.bot_dealer_address || ''}
                  onChange={(e) => setSettings({ ...settings, bot_dealer_address: e.target.value })}
                  placeholder="Jl. Raya Otomotif No. 123, Jakarta"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Semua konfigurasi disimpan secara dinamis ke database dan berlaku realtime.
        </div>
        <button
          onClick={() => handleSaveSettings()}
          disabled={savingSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
        >
          {savingSettings ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : savedSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{savedSuccess ? 'Tersimpan!' : savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
        </button>
      </div>
    </div>
  );
};
