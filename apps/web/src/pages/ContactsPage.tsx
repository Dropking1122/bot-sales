import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Users, Plus, Search, Tag, Check, AlertCircle, X, Loader2, ShieldCheck, ShieldAlert, Tag as TagIcon } from 'lucide-react';

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Add Contact Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('DIRECT');
  const [interestedMotorcycle, setInterestedMotorcycle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [consentStatus, setConsentStatus] = useState('GRANTED');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Tag Modal
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append('page', String(page));
      if (search) q.append('search', search);

      const res = await apiRequest(`/contacts?${q.toString()}`);
      if (res.success) {
        setContacts(res.data);
        setTotalPages(res.meta?.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [page, search]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await apiRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          source: source.trim(),
          interestedMotorcycle: interestedMotorcycle.trim() || null,
          consentStatus,
          tags
        })
      });

      if (res.success) {
        setShowAddModal(false);
        setName('');
        setPhone('');
        setEmail('');
        setInterestedMotorcycle('');
        setTagsInput('');
        loadContacts();
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan kontak');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkTagInput.trim()) return;
    setBulkSaving(true);

    try {
      const tags = bulkTagInput.split(',').map((t) => t.trim()).filter(Boolean);
      await apiRequest('/contacts/bulk-tags', {
        method: 'POST',
        body: JSON.stringify({
          contactIds: selectedIds,
          tags
        })
      });
      setShowBulkTagModal(false);
      setBulkTagInput('');
      setSelectedIds([]);
      loadContacts();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan tag massal');
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(contacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Manajemen Kontak
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Daftar kontak calon pembeli, status persetujuan WhatsApp (consent), dan label
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkTagModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
            >
              <TagIcon className="w-4 h-4" />
              <span>Beri Tag ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kontak</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, nomor WhatsApp (contoh: 0812 / 628), atau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedIds.length === contacts.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-4">Nama</th>
                <th className="py-3 px-4">No. WhatsApp</th>
                <th className="py-3 px-4">Tag</th>
                <th className="py-3 px-4">Minat Motor</th>
                <th className="py-3 px-4">Sumber</th>
                <th className="py-3 px-4">Persetujuan</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Memuat data kontak...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Belum ada data kontak.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {c.name}
                      {c.email && <p className="text-[10px] text-slate-400 font-normal">{c.email}</p>}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {c.phoneNormalized}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.tags && c.tags.length > 0 ? (
                          c.tags.map((t: any) => (
                            <span key={t.id} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {t.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {c.interestedMotorcycle || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.source}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.consentStatus === 'GRANTED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {c.consentStatus === 'GRANTED' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        <span>{c.consentStatus}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.isOptOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          Opt-Out
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tambah Kontak Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateContact} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Nomor WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081298765432"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Email (Opsional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Minat Motor</label>
                <input
                  type="text"
                  placeholder="Contoh: Vario 160"
                  value={interestedMotorcycle}
                  onChange={(e) => setInterestedMotorcycle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Tag (Pisahkan koma)</label>
                <input
                  type="text"
                  placeholder="Matic, Follow-up"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Status Persetujuan Komunikasi</label>
                <select
                  value={consentStatus}
                  onChange={(e) => setConsentStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="GRANTED">GRANTED (Setuju menerima pesan)</option>
                  <option value="PENDING">PENDING (Belum konfirmasi)</option>
                  <option value="DENIED">DENIED (Menolak)</option>
                  <option value="OPT_OUT">OPT_OUT (Berhenti)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-sm">Beri Tag ke {selectedIds.length} Kontak</h3>
            <form onSubmit={handleBulkTag} className="space-y-3">
              <input
                type="text"
                placeholder="Contoh: Pameran Mall, Prospek Panas"
                required
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkTagModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  {bulkSaving ? 'Menyimpan...' : 'Terapkan Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
