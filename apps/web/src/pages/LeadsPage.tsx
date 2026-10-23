import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { TrendingUp, Search, Calendar, User, Bike, Check, Edit2, AlertCircle, Loader2 } from 'lucide-react';

const LEAD_STATUSES = [
  'BARU',
  'DIHUBUNGI',
  'TERTARIK',
  'NEGOSIASI',
  'MENUNGGU_KEPUTUSAN',
  'BERHASIL',
  'TIDAK_BERHASIL'
];

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.append('status', statusFilter);
      if (search) q.append('search', search);

      const res = await apiRequest(`/leads?${q.toString()}`);
      if (res.success) {
        setLeads(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, search]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await apiRequest(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      loadLeads();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatIDR = (val?: number | null) => {
    if (!val) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'BARU':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case 'DIHUBUNGI':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
      case 'TERTARIK':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
      case 'NEGOSIASI':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'MENUNGGU_KEPUTUSAN':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300';
      case 'BERHASIL':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'TIDAK_BERHASIL':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Manajemen Leads / Calon Pembeli
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pantau progres prospek penjualan, motor yang diminati, dan jadwal follow-up
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama calon pembeli atau nomor WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="w-full sm:w-52">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          >
            <option value="">Semua Status Lead</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Calon Pembeli</th>
                <th className="py-3 px-4">Motor Diminati</th>
                <th className="py-3 px-4">Rencana DP & Tenor</th>
                <th className="py-3 px-4">Sales PIC</th>
                <th className="py-3 px-4">Status Prospek</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4">Tanggal Masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat data leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada data leads yang sesuai.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{l.customerName}</p>
                      <p className="font-mono text-[10px] text-slate-500">{l.phone}</p>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {l.motorcycle?.name || 'Belum dipilih'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div>DP: {formatIDR(l.dpPlanned ? Number(l.dpPlanned) : null)}</div>
                      <div className="text-[10px] text-slate-400">Tenor: {l.tenorPlanned ? `${l.tenorPlanned} bln` : '-'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {l.assignedSales?.name || 'Belum ditugaskan'}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        disabled={updatingId === l.id}
                        value={l.status}
                        onChange={(e) => handleStatusChange(l.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${getStatusBadge(
                          l.status
                        )}`}
                      >
                        {LEAD_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {l.notes || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(l.createdAt).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
