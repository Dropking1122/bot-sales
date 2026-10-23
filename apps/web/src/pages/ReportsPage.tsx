import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { BarChart3, TrendingUp, MessageSquare, Radio, CheckCircle, Clock } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [leadReport, setLeadReport] = useState<any | null>(null);
  const [broadcastReport, setBroadcastReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const [lRes, bRes] = await Promise.all([
          apiRequest('/reports/leads'),
          apiRequest('/reports/broadcasts')
        ]);
        if (lRes.success) setLeadReport(lRes.data);
        if (bRes.success) setBroadcastReport(bRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Laporan & Analitik Penjualan
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Statistik konversi prospek lead dan metrik performa broadcast WhatsApp
        </p>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Leads Performance Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Performa Lead & Konversi</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              Konversi: {leadReport?.conversionRate || 0}%
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Total Prospek Masuk</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{leadReport?.totalLeads || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Penjualan Berhasil (Closing)</span>
              <span className="font-bold text-emerald-600">{leadReport?.successfulLeads || 0}</span>
            </div>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Distribusi Status Lead:</p>
            {leadReport?.byStatus?.map((item: any) => (
              <div key={item.status} className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{item.status}</span>
                  <span className="font-mono font-medium">{item.count}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{
                      width: `${leadReport.totalLeads > 0 ? (item.count / leadReport.totalLeads) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Broadcast Performance Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-600" />
              <span>Efektivitas Broadcast WhatsApp</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Delivery Rate: {broadcastReport?.deliveryRate || 0}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <p className="text-xs text-slate-400">Total Kampanye</p>
              <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">
                {broadcastReport?.totalCampaigns || 0}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-center">
              <p className="text-xs text-emerald-600">Pesan Terkirim</p>
              <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                {broadcastReport?.totalSent || 0}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Total Target Audiens</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {broadcastReport?.totalTarget || 0}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Pesan Gagal Terkirim</span>
              <span className="font-mono font-bold text-rose-600">
                {broadcastReport?.totalFailed || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
