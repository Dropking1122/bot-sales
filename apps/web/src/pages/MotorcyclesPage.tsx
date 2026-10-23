import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Bike, Plus, Search, Filter, Trash2, Edit, Image, Check, AlertCircle, X, Loader2, Tag, Layers } from 'lucide-react';

export const MotorcyclesPage: React.FC = () => {
  const [motorcycles, setMotorcycles] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formCategory, setFormCategory] = useState('Matic');
  const [formCondition, setFormCondition] = useState('BARU');
  const [formPriceOtr, setFormPriceOtr] = useState('');
  const [formMinDp, setFormMinDp] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Image Upload State
  const [uploadModalMotor, setUploadModalMotor] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Brand Manage Modal
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Category Manage Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.append('page', String(page));
      if (search) query.append('search', search);
      if (selectedBrand) query.append('brandId', selectedBrand);

      const [resMotors, resBrands] = await Promise.all([
        apiRequest(`/motorcycles?${query.toString()}`),
        apiRequest('/brands')
      ]);

      if (resMotors.success) {
        setMotorcycles(resMotors.data);
        setTotalPages(resMotors.meta?.totalPages || 1);
      }
      if (resBrands.success) {
        setBrands(resBrands.data);
        if (!formBrandId && resBrands.data.length > 0) {
          setFormBrandId(resBrands.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, selectedBrand]);

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError(null);

    try {
      const payload = {
        sku: formSku.trim(),
        name: formName.trim(),
        brandId: formBrandId,
        model: formModel.trim() || formName.trim(),
        year: Number(formYear),
        category: formCategory,
        condition: formCondition,
        priceOtr: Number(formPriceOtr),
        minDp: formMinDp ? Number(formMinDp) : null,
        description: formDescription.trim(),
        stockStatus: 'TERSEDIA',
        isActive: true
      };

      const res = await apiRequest('/motorcycles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setShowAddModal(false);
        // Reset form
        setFormSku('');
        setFormName('');
        setFormPriceOtr('');
        setFormMinDp('');
        setFormDescription('');
        loadData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan motor');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus motor "${name}"?`)) return;
    try {
      await apiRequest(`/motorcycles/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus motor');
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadModalMotor) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('images', selectedFile);

      await apiRequest(`/motorcycles/${uploadModalMotor.id}/images`, {
        method: 'POST',
        body: formData
      });

      setSelectedFile(null);
      setUploadModalMotor(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // ─── Brand CRUD ───
  const loadCategories = async () => {
    try {
      const res = await apiRequest('/settings/categories');
      if (res.success) setCategories(res.data);
    } catch {}
  };

  const handleAddBrand = async () => {
    const name = newBrandName.trim();
    if (!name) return;
    setBrandSaving(true);
    setBrandError(null);
    try {
      if (editingBrand) {
        await apiRequest(`/brands/${editingBrand.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name })
        });
      } else {
        await apiRequest('/brands', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
      }
      setNewBrandName('');
      setEditingBrand(null);
      loadData();
    } catch (err: any) {
      setBrandError(err.message || 'Gagal menyimpan merk');
    } finally {
      setBrandSaving(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!confirm(`Hapus merk "${name}"?`)) return;
    try {
      await apiRequest(`/brands/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      setBrandError(err.message || 'Gagal menghapus merk');
    }
  };

  // ─── Category CRUD ───
  const handleAddCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    setCategorySaving(true);
    try {
      const res = await apiRequest('/settings/categories', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      if (res.success) setCategories(res.data);
      setNewCategory('');
    } catch (err: any) {
      alert(err.message || 'Gagal menambah kategori');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!confirm(`Hapus kategori "${name}"?`)) return;
    try {
      const res = await apiRequest(`/settings/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.success) setCategories(res.data);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kategori');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Katalog Motor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola data motor, spesifikasi, harga OTR, dan foto unit
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => { setShowBrandModal(true); setBrandError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Kelola Merk</span>
          </button>
          <button
            onClick={() => { setShowCategoryModal(true); loadCategories(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kelola Kategori</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Motor</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama motor, SKU, atau model..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          >
            <option value="">Semua Merek</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">SKU / Motor</th>
                <th className="py-3 px-4">Merek</th>
                <th className="py-3 px-4">Kategori & Kondisi</th>
                <th className="py-3 px-4">Harga OTR</th>
                <th className="py-3 px-4">DP Min</th>
                <th className="py-3 px-4">Stok</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat data motor...
                  </td>
                </tr>
              ) : motorcycles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada motor yang sesuai filter.
                  </td>
                </tr>
              ) : (
                motorcycles.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                          {m.images && m.images[0] ? (
                            <img src={m.images[0].url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <Bike className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{m.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {m.brand?.name || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {m.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold">
                          {m.condition}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {formatIDR(Number(m.priceOtr))}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {m.minDp ? formatIDR(Number(m.minDp)) : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        m.stockStatus === 'TERSEDIA'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {m.stockStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setUploadModalMotor(m)}
                          title="Upload Foto"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Image className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          title="Hapus"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Halaman {page} dari {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Motor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tambah Motor Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">SKU / Kode Motor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: HND-VAR-160"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Merek *</label>
                  <select
                    value={formBrandId}
                    onChange={(e) => setFormBrandId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Motor *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Honda Vario 160 CBS"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tahun</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kondisi</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="BARU">BARU</option>
                    <option value="BEKAS">BEKAS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Harga OTR (Rp) *</label>
                  <input
                    type="number"
                    required
                    placeholder="27500000"
                    value={formPriceOtr}
                    onChange={(e) => setFormPriceOtr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">DP Minimum (Rp)</label>
                  <input
                    type="number"
                    placeholder="2500000"
                    value={formMinDp}
                    onChange={(e) => setFormMinDp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Deskripsi / Spesifikasi</label>
                <textarea
                  rows={3}
                  placeholder="Informasi mesin, fitur kunci, varian warna..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Motor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Image Modal */}
      {uploadModalMotor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Upload Foto - {uploadModalMotor.name}
              </h3>
              <button onClick={() => setUploadModalMotor(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadImage} className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalMotor(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Upload</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Manage Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4" /> Kelola Merk Motor
              </h3>
              <button onClick={() => { setShowBrandModal(false); setEditingBrand(null); setNewBrandName(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {brandError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{brandError}</span>
                </div>
              )}

              {/* Add / Edit Brand */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama merk baru..."
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddBrand}
                  disabled={brandSaving || !newBrandName.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                >
                  {brandSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {editingBrand ? 'Simpan' : 'Tambah'}
                </button>
                {editingBrand && (
                  <button onClick={() => { setEditingBrand(null); setNewBrandName(''); }} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs">
                    Batal
                  </button>
                )}
              </div>

              {/* Brand List */}
              <div className="space-y-1.5">
                {brands.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada merk</p>
                )}
                {brands.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 group">
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{b.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingBrand(b); setNewBrandName(b.name); }}
                        className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBrand(b.id, b.name)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Manage Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4" /> Kelola Kategori Motor
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Add Category */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama kategori baru..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={categorySaving || !newCategory.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                >
                  {categorySaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Tambah
                </button>
              </div>

              {/* Category List */}
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4 w-full">Belum ada kategori</p>
                )}
                {categories.map((cat) => (
                  <div key={cat} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-300">
                    <span>{cat}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-600 dark:text-amber-400"
                      title="Hapus"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
