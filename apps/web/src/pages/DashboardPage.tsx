import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import {
  Bike,
  Users,
  MessageSquare,
  TrendingUp,
  Radio,
  Wifi,
  Database,
  Server,
  ArrowUpRight,
  Clock,
  Send,
  DownloadCloud
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await apiRequest('/dashboard/summary');
        if (res.success) {
          setData(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const counts = data?.counts || {};
  const services = data?.services || {};

  const metricCards = [
    {
      title: 'Motor Aktif',
      value: counts.activeMotorcycles || 0,
      sub: `${counts.totalBrands || 0} Brand terdaftar`,
      icon: Bike,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400',
      link: '/motorcycles'
    },
    {
      title: 'Total Kontak',
      value: counts.totalContacts || 0,
      sub: 'Kontak WhatsApp',
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400',
      link: '/contacts'
    },
    {
      title: 'Leads Prospek',
      value: counts.totalLeads || 0,
      sub: `${counts.newLeads || 0} Perlu Follow-up`,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
      link: '/leads'
    },
    {
      title: 'Percakapan Chat',
      value: counts.totalConversations || 0,
      sub: `${counts.inboundMessages || 0} Masuk / ${counts.outboundMessages || 0} Keluar`,
      icon: MessageSquare,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400',
      link: '/inbox'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard Utama
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitoring performa bot, katalog, dan kampanye broadcast dealer
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <NavLink
            to="/imports"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <DownloadCloud className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Import Excel</span>
          </NavLink>
          <NavLink
            to="/broadcasts"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Radio className="w-4 h-4" />
            <span>Buat Broadcast</span>
          </NavLink>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <NavLink
              key={idx}
              to={card.link}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                  <p className="text-2xl font-bold mt-1.5 text-slate-900 dark:text-white">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>{card.sub}</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* Services Health & System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Database PostgreSQL</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{services.database || 'CONNECTED'}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Antrean Redis Queue</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{services.redis || 'CONNECTED'}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${services.whatsapp === 'CONNECTED' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'}`}>
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Koneksi WhatsApp Bot</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{services.whatsapp || 'DISCONNECTED'}</p>
          </div>
        </div>
      </div>

      {/* Recent Activities Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Aktivitas Sistem Terbaru
            </h2>
          </div>
          <NavLink to="/audit-logs" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Lihat Semua
          </NavLink>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Pengguna</th>
                <th className="py-2.5 px-3">Aksi</th>
                <th className="py-2.5 px-3">Entitas</th>
                <th className="py-2.5 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.map((act: any) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(act.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {act.admin?.name || 'Sistem'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {act.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{act.entity}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{act.ipAddress || 'localhost'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Belum ada log aktivitas terbaru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
