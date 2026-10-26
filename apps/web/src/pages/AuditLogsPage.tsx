import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEntity = searchParams.get('entity') || 'ALL';

  const [activeTab, setActiveTab] = useState<string>(initialEntity);
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');

      if (activeTab && activeTab !== 'ALL') {
        params.set('entity', activeTab);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }

      const res = await apiRequest(`/audit-logs?${params.toString()}`);
      if (res.success) {
        setLogs(res.data);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalCount(res.meta?.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === 'ALL') {
      searchParams.delete('entity');
    } else {
      searchParams.set('entity', tab);
    }
    setSearchParams(searchParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const getEntityBadge = (entity: string, action: string) => {
    if (entity === 'SECURITY_ALERT' || action.includes('ATTACK') || action.includes('FAILED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>SERANGAN HACKER</span>
        </span>
      );
    }
    if (entity === 'SYSTEM_ERROR' || action.includes('ERROR')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>ERROR SISTEM</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
        <Activity className="w-3 h-3 text-blue-500" />
        <span>{entity}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Log Keamanan &amp; Aktivitas Sistem</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pemantauan langsung serangan siber (WAF), error runtime server, dan riwayat aktivitas operasional
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleTabChange('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Semua Log
          </button>
          <button
            onClick={() => handleTabChange('SECURITY_ALERT')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'SECURITY_ALERT'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/20'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>🚨 Serangan Hacker &amp; WAF</span>
          </button>
          <button
            onClick={() => handleTabChange('SYSTEM_ERROR')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'SYSTEM_ERROR'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/20'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>⚠️ Error Runtime Sistem</span>
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari berdasarkan IP Address, tipe serangan, aksi, atau user agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
          >
            Cari
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                loadLogs();
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Logs Table & Mobile Cards */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Waktu</th>
                <th className="py-3 px-4 whitespace-nowrap">Kategori / Entitas</th>
                <th className="py-3 px-4 whitespace-nowrap">Aksi / Ancaman</th>
                <th className="py-3 px-4 whitespace-nowrap">Pengguna / Sales</th>
                <th className="py-3 px-4 whitespace-nowrap">Detail Kejadian</th>
                <th className="py-3 px-4 whitespace-nowrap">IP &amp; Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Memuat catatan log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {activeTab === 'SECURITY_ALERT'
                      ? 'Aman! Belum ada rekaman serangan siber yang terdeteksi.'
                      : activeTab === 'SYSTEM_ERROR'
                      ? 'Lancar! Belum ada rekaman error sistem internal.'
                      : 'Belum ada catatan log aktivitas.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isThreat = log.entity === 'SECURITY_ALERT';
                  const isError = log.entity === 'SYSTEM_ERROR';
                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors ${
                        isThreat
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70'
                          : isError
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4">
                        {getEntityBadge(log.entity, log.action)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            isThreat
                              ? 'text-rose-600 dark:text-rose-400'
                              : isError
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {log.admin?.name || (isThreat ? '⚠️ Unknown Attacker' : 'Sistem')}
                        {log.admin?.role && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400">({log.admin.role})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-md">
                        {log.details ? (
                          <div className="font-mono text-[11px] space-y-0.5">
                            {log.details.attackType && (
                              <div className="font-bold text-rose-600 dark:text-rose-400">
                                Tipe: {log.details.attackType}
                              </div>
                            )}
                            {log.details.path && (
                              <div className="text-slate-600 dark:text-slate-400 truncate">
                                Target: {log.details.method || ''} {log.details.path}
                              </div>
                            )}
                            {log.details.sample && (
                              <div className="text-rose-700 dark:text-rose-300 font-bold bg-rose-100/60 dark:bg-rose-950/60 px-1.5 py-0.5 rounded truncate">
                                Payload: {log.details.sample}
                              </div>
                            )}
                            {log.details.message && !log.details.attackType && (
                              <div className="truncate text-slate-800 dark:text-slate-200">
                                {log.details.message}
                              </div>
                            )}
                            {!log.details.attackType && !log.details.path && !log.details.message && (
                              <span className="truncate block">{JSON.stringify(log.details)}</span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white block">{log.ipAddress || '-'}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={log.userAgent}>
                          {log.userAgent ? log.userAgent.split(' ')[0] : ''}
                        </span>
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
            <div className="py-12 text-center text-slate-400 text-xs">Memuat catatan log...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Belum ada catatan log.</div>
          ) : (
            logs.map((log) => {
              const isThreat = log.entity === 'SECURITY_ALERT';
              const isError = log.entity === 'SYSTEM_ERROR';
              return (
                <div
                  key={log.id}
                  className={`p-4 space-y-2.5 text-xs ${
                    isThreat
                      ? 'bg-rose-50/30 dark:bg-rose-950/20'
                      : isError
                      ? 'bg-amber-50/30 dark:bg-amber-950/20'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {getEntityBadge(log.entity, log.action)}
                      <h4
                        className={`font-mono font-bold text-xs mt-1 ${
                          isThreat
                            ? 'text-rose-600 dark:text-rose-400'
                            : isError
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {log.action}
                      </h4>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.admin?.name || (isThreat ? '⚠️ Unknown Attacker' : 'Sistem')}
                    </span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      IP: {log.ipAddress || '-'}
                    </span>
                  </div>

                  {log.details && (
                    <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 space-y-1 font-mono text-[11px]">
                      {log.details.attackType && (
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          🚨 Tipe: {log.details.attackType}
                        </div>
                      )}
                      {log.details.path && (
                        <div className="text-slate-700 dark:text-slate-300 break-all">
                          Target: {log.details.method || ''} {log.details.path}
                        </div>
                      )}
                      {log.details.sample && (
                        <div className="text-rose-700 dark:text-rose-300 font-bold bg-rose-200/50 dark:bg-rose-950/50 p-1.5 rounded break-all">
                          Payload: {log.details.sample}
                        </div>
                      )}
                      {log.details.message && !log.details.attackType && (
                        <div className="text-slate-700 dark:text-slate-300 break-words">
                          {log.details.message}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-right text-[10px] font-mono text-slate-400">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
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
              Total {totalCount} log • Halaman {page} dari {totalPages}
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
    </div>
  );
};
