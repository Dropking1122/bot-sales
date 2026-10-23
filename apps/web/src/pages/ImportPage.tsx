import React, { useState } from 'react';
import { apiRequest, downloadBlob } from '../lib/api';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  FileDown
} from 'lucide-react';

export const ImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MOTORCYCLE' | 'CONTACT'>('MOTORCYCLE');

  // File & Preview State
  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [strategy, setStrategy] = useState('UPSERT');
  const [executing, setExecuting] = useState(false);
  const [resultJob, setResultJob] = useState<any | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const endpoint = activeTab === 'MOTORCYCLE' ? '/imports/motorcycles/template' : '/imports/contacts/template';
      const filename = activeTab === 'MOTORCYCLE' ? 'template-import-motor.xlsx' : 'template-import-kontak.xlsx';
      const blob = await apiRequest(endpoint);
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh template');
    }
  };

  const handleUploadPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoadingPreview(true);
    setPreviewData(null);
    setResultJob(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = activeTab === 'MOTORCYCLE' ? '/imports/motorcycles/preview' : '/imports/contacts/preview';
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: formData
      });

      if (res.success) {
        setPreviewData(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewData?.fileId) return;
    setExecuting(true);

    try {
      const endpoint = activeTab === 'MOTORCYCLE' ? '/imports/motorcycles' : '/imports/contacts';
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          fileId: previewData.fileId,
          strategy
        })
      });

      if (res.success) {
        setResultJob(res.data);
        setPreviewData(null);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengeksekusi import');
    } finally {
      setExecuting(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!resultJob?.id) return;
    try {
      const blob = await apiRequest(`/imports/${resultJob.id}/errors/export`);
      downloadBlob(blob, `laporan-error-import-${resultJob.id}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh laporan error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Import Data Excel / CSV
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Import massal katalog motor dan kontak WhatsApp dengan validasi dan laporan error
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Download Template Excel ({activeTab === 'MOTORCYCLE' ? 'Motor' : 'Kontak'})</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActiveTab('MOTORCYCLE');
            setPreviewData(null);
            setResultJob(null);
            setFile(null);
          }}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'MOTORCYCLE'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Import Data Motor (.xlsx / .csv)
        </button>
        <button
          onClick={() => {
            setActiveTab('CONTACT');
            setPreviewData(null);
            setResultJob(null);
            setFile(null);
          }}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'CONTACT'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Import Kontak WhatsApp (.xlsx / .csv)
        </button>
      </div>

      {/* Upload Box */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleUploadPreview} className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Pilih file spreadsheet (.xlsx atau .csv)
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Maksimum ukuran 10MB atau 5.000 baris data</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white cursor-pointer"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!file || loadingPreview}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {loadingPreview && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loadingPreview ? 'Membaca File...' : 'Upload & Tampilkan Preview'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Hasil Validasi & Preview Import
              </h2>
              <p className="text-xs text-slate-500">
                Total Baris: <span className="font-bold">{previewData.totalRows}</span> • Valid:{' '}
                <span className="font-bold text-emerald-600">{previewData.validCount}</span> • Error:{' '}
                <span className="font-bold text-rose-600">{previewData.errorCount}</span> • Konflik SKU/No:{' '}
                <span className="font-bold text-amber-600">{previewData.conflictCount}</span>
              </p>
            </div>

            {/* Strategy selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Strategi:</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="UPSERT">UPSERT (Tambah baru & update yang cocok)</option>
                <option value="INSERT_ONLY">Hanya Tambah Baru (Abaikan duplikat)</option>
                <option value="UPDATE_ONLY">Hanya Update Data yang Sudah Ada</option>
                <option value="ABORT_ON_ERROR">Batalkan Semua jika Ada Error</option>
              </select>

              <button
                disabled={executing}
                onClick={handleExecuteImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {executing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Eksekusi Import</span>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">No Baris</th>
                  <th className="py-2.5 px-3">Identifier (SKU / No HP)</th>
                  <th className="py-2.5 px-3">Nama</th>
                  <th className="py-2.5 px-3">Aksi</th>
                  <th className="py-2.5 px-3">Status Validasi</th>
                  <th className="py-2.5 px-3">Keterangan Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewData.previewRows.map((row: any, idx: number) => (
                  <tr key={idx} className={row.status === 'ERROR' ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}>
                    <td className="py-2 px-3 font-mono">{row.rowNumber}</td>
                    <td className="py-2 px-3 font-mono font-medium">{row.sku || row.phoneNormalized}</td>
                    <td className="py-2 px-3">{row.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
                        {row.action}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {row.status === 'VALID' ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-rose-600 text-[11px]">
                      {row.errors?.join('; ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result Section */}
      {resultJob && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Import Selesai Diproses!
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <p className="text-xs text-slate-400">Total Baris</p>
              <p className="text-xl font-bold mt-1">{resultJob.totalRows}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
              <p className="text-xs text-emerald-600">Berhasil Masuk</p>
              <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{resultJob.successCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50">
              <p className="text-xs text-blue-600">Berhasil Diupdate</p>
              <p className="text-xl font-bold mt-1 text-blue-700 dark:text-blue-300">{resultJob.updatedCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50">
              <p className="text-xs text-rose-600">Gagal / Ditolak</p>
              <p className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-300">{resultJob.failedCount}</p>
            </div>
          </div>

          {resultJob.failedCount > 0 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleDownloadErrors}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                <span>Unduh Laporan Error Excel</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
