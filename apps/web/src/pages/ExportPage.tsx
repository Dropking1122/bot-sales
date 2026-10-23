import React, { useState } from 'react';
import { apiRequest, downloadBlob } from '../lib/api';
import { FileSpreadsheet, Download, Bike, Users, TrendingUp, Loader2 } from 'lucide-react';

export const ExportPage: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (type: 'motorcycles' | 'contacts' | 'leads') => {
    setDownloading(type);
    try {
      const blob = await apiRequest(`/exports/${type}`);
      downloadBlob(blob, `export-${type}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Gagal mengekspor data');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Export Data Excel
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Unduh data operasional lengkap ke format spreadsheet Excel (.xlsx) dengan proteksi sanitasi sel
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Motor Export */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Export Katalog Motor</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Daftar semua unit motor, SKU, harga OTR, ketersediaan stok, DP minimum, dan spesifikasi.
              </p>
            </div>
          </div>

          <button
            disabled={downloading === 'motorcycles'}
            onClick={() => handleExport('motorcycles')}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'motorcycles' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Unduh Excel Motor (.xlsx)</span>
          </button>
        </div>

        {/* Contacts Export */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Export Kontak Pelanggan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Database nomor WhatsApp dinormalisasi, tag minat, status persetujuan (consent), dan opt-out.
              </p>
            </div>
          </div>

          <button
            disabled={downloading === 'contacts'}
            onClick={() => handleExport('contacts')}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'contacts' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Unduh Excel Kontak (.xlsx)</span>
          </button>
        </div>

        {/* Leads Export */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Export Data Leads</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Rekapitulasi calon pembeli, tahapan negosiasi, sales penanggung jawab, dan catatan prospek.
              </p>
            </div>
          </div>

          <button
            disabled={downloading === 'leads'}
            onClick={() => handleExport('leads')}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'leads' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Unduh Excel Leads (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
