import React, { useState, useEffect } from 'react';
import { apiRequest, downloadBlob } from '../lib/api';
import {
  Radio,
  Plus,
  Play,
  Pause,
  XCircle,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  X,
  Loader2,
  Eye
} from 'lucide-react';

export const BroadcastsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Wizard Modal
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('PROMO');
  const [description, setDescription] = useState('');
  const [tagsFilter, setTagsFilter] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    'Halo {{nama}}! Dapatkan promo spesial motor Honda & Yamaha dengan DP ringan dan cicilan terjangkau bulan ini. Balas pesan ini untuk info promo selengkapnya! 🏍️'
  );
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCampaigns = async () => {
    try {
      const res = await apiRequest(`/broadcasts?page=${page}`);
      if (res.success) {
        setCampaigns(res.data);
        setTotalPages(res.meta?.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadCampaigns();
    }, 5000); // 5s refresh for broadcast progress
    return () => clearInterval(interval);
  }, [page]);

  const handleFetchPreview = async () => {
    setPreviewLoading(true);
    try {
      const tags = tagsFilter ? tagsFilter.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
      const res = await apiRequest('/broadcasts/preview', {
        method: 'POST',
        body: JSON.stringify({
          recipientFilter: { tags },
          messageTemplate
        })
      });

      if (res.success) {
        setPreviewData(res.data);
        setStep(3);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memuat preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    setSaving(true);
    try {
      const tags = tagsFilter ? tagsFilter.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
      const res = await apiRequest('/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName.trim(),
          campaignType,
          description: description.trim() || null,
          messageTemplate,
          recipientFilter: { tags }
        })
      });

      if (res.success) {
        setShowWizard(false);
        // Reset wizard
        setStep(1);
        setCampaignName('');
        setTagsFilter('');
        loadCampaigns();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat kampanye');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: 'start' | 'pause' | 'cancel' | 'retry') => {
    try {
      await apiRequest(`/broadcasts/${id}/${action}`, { method: 'POST' });
      loadCampaigns();
    } catch (err: any) {
      alert(err.message || `Gagal menjalankan aksi ${action}`);
    }
  };

  const handleDownloadReport = async (id: string, name: string) => {
    try {
      const blob = await apiRequest(`/broadcasts/${id}/report`);
      downloadBlob(blob, `laporan-broadcast-${name.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh laporan');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'PAUSED':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Broadcast Kampanye WhatsApp
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kirim pesan massal terpersonalisasi kepada kontak yang telah menyetujui komunikasi
          </p>
        </div>

        <button
          onClick={() => {
            setStep(1);
            setShowWizard(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Kampanye Baru</span>
        </button>
      </div>

      {/* Campaigns Table & Mobile Cards */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Nama Kampanye</th>
                <th className="py-3 px-4 whitespace-nowrap">Tipe</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Target / Sukses / Gagal</th>
                <th className="py-3 px-4 whitespace-nowrap">Progres</th>
                <th className="py-3 px-4 whitespace-nowrap">Waktu Dibuat</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat daftar kampanye...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada kampanye broadcast yang dibuat.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const percent = c.totalTarget > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalTarget) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {c.name}
                        {c.description && <p className="text-[10px] text-slate-400 font-normal">{c.description}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {c.campaignType}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">{c.totalTarget}</span> target •{' '}
                        <span className="text-emerald-600 font-semibold">{c.sentCount}</span> terkirim •{' '}
                        <span className="text-rose-600 font-semibold">{c.failedCount}</span> gagal
                      </td>
                      <td className="py-3.5 px-4 w-36">
                        <div className="space-y-1">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400 text-right">{percent}%</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'DRAFT' || c.status === 'PAUSED' ? (
                            <button
                              onClick={() => handleAction(c.id, 'start')}
                              title="Jalankan Pengiriman"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : c.status === 'RUNNING' ? (
                            <button
                              onClick={() => handleAction(c.id, 'pause')}
                              title="Jeda Pengiriman"
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          {c.status === 'RUNNING' || c.status === 'PAUSED' ? (
                            <button
                              onClick={() => handleAction(c.id, 'cancel')}
                              title="Batalkan Kampanye"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          {c.failedCount > 0 && (c.status === 'COMPLETED' || c.status === 'FAILED' || c.status === 'PAUSED') ? (
                            <button
                              onClick={() => handleAction(c.id, 'retry')}
                              title="Kirim Ulang Penerima Gagal"
                              className="p-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleDownloadReport(c.id, c.name)}
                            title="Unduh Laporan Excel"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Memuat daftar kampanye...</div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Belum ada kampanye broadcast yang dibuat.</div>
          ) : (
            campaigns.map((c) => {
              const percent = c.totalTarget > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalTarget) * 100) : 0;
              return (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">{c.name}</h4>
                      {c.description && <p className="text-[11px] text-slate-400 mt-0.5">{c.description}</p>}
                      <span className="inline-block mt-1 text-[10px] text-slate-500 font-medium">{c.campaignType}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Target: <strong className="text-slate-800 dark:text-slate-200">{c.totalTarget}</strong></span>
                      <span className="text-emerald-600 font-semibold">{c.sentCount} terkirim</span>
                      <span className="text-rose-600 font-semibold">{c.failedCount} gagal</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Progres: {percent}%</span>
                      <span>Dibuat: {new Date(c.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {c.status === 'DRAFT' || c.status === 'PAUSED' ? (
                      <button
                        onClick={() => handleAction(c.id, 'start')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mulai</span>
                      </button>
                    ) : c.status === 'RUNNING' ? (
                      <button
                        onClick={() => handleAction(c.id, 'pause')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Jeda</span>
                      </button>
                    ) : null}

                    {c.status === 'RUNNING' || c.status === 'PAUSED' ? (
                      <button
                        onClick={() => handleAction(c.id, 'cancel')}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        title="Batal"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : null}

                    {c.failedCount > 0 && (c.status === 'COMPLETED' || c.status === 'FAILED' || c.status === 'PAUSED') ? (
                      <button
                        onClick={() => handleAction(c.id, 'retry')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Gagal</span>
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleDownloadReport(c.id, c.name)}
                      className="p-2 rounded-lg text-slate-500 hover:text-blue-600 bg-slate-100 dark:bg-slate-800"
                      title="Unduh Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Sebelumnya
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Buat Kampanye Broadcast (Langkah {step} dari 3)
                </h3>
                <p className="text-[11px] text-slate-400">
                  {step === 1 ? 'Informasi Kampanye' : step === 2 ? 'Target Penerima & Pesan' : 'Review & Konfirmasi'}
                </p>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Nama Kampanye *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Promo Akhir Tahun Honda 2026"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Tipe Kampanye</label>
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <option value="PROMO">Promo & Diskon</option>
                      <option value="NEW_UNIT">Informasi Motor Baru</option>
                      <option value="FOLLOW_UP">Follow-up Prospek</option>
                      <option value="SERVICE">Layanan & Operasional</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Catatan / Deskripsi Internal</label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Catatan untuk tim dealer..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Filter Tag Kontak (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Matic, Follow-up (Kosongkan untuk semua)"
                      value={tagsFilter}
                      onChange={(e) => setTagsFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    Hanya kontak dengan persetujuan <span className="font-semibold text-emerald-600">GRANTED</span> yang
                    akan menerima kampanye ini. Kontak yang opt-out otomatis dikecualikan.
                  </p>

                  <div className="space-y-1 pt-2">
                    <label className="text-xs font-semibold">Template Pesan WhatsApp</label>
                    <textarea
                      rows={5}
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Variabel yang didukung: <span className="font-mono text-blue-500">{`{{nama}}`}</span>, <span className="font-mono text-blue-500">{`{{minat_motor}}`}</span>
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      Ringkasan Target Penerima:
                    </p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                      {previewData?.totalEligible || 0} Kontak Terpilih
                    </p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                      Kontak yang memenuhi syarat consent dan tidak opt-out.
                    </p>
                  </div>

                  {previewData?.samples && previewData.samples.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Contoh Tampilan Pesan di HP Pelanggan:
                      </p>
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs leading-relaxed font-sans whitespace-pre-wrap border border-slate-200 dark:border-slate-700">
                        {previewData.samples[0].previewMessage}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                >
                  Kembali
                </button>
              ) : <div />}

              {step === 1 ? (
                <button
                  disabled={!campaignName.trim()}
                  onClick={() => setStep(2)}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Lanjut ke Target
                </button>
              ) : step === 2 ? (
                <button
                  disabled={previewLoading || !messageTemplate.trim()}
                  onClick={handleFetchPreview}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lihat Preview</span>
                </button>
              ) : (
                <button
                  disabled={saving || !previewData?.totalEligible}
                  onClick={handleCreateCampaign}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi & Simpan Kampanye</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
