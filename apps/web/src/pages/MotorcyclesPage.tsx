import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Bike, Plus, Search, Filter, Trash2, Edit, Image, Check, AlertCircle, X, Loader2, Tag, Layers, Palette } from 'lucide-react';

export const MotorcyclesPage: React.FC = () => {
  const [motorcycles, setMotorcycles] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add/Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState<any | null>(null);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formCategory, setFormCategory] = useState('Matic');
  const [formCondition, setFormCondition] = useState('BARU');
  const [formPriceOtr, setFormPriceOtr] = useState('');
  const [formMinDp, setFormMinDp] = useState('');
  const [formStockStatus, setFormStockStatus] = useState('TERSEDIA');
  const [formDescription, setFormDescription] = useState('');
  const [formColors, setFormColors] = useState<string[]>([]);
  const [newColorInput, setNewColorInput] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Image Upload State
  const [uploadModalMotor, setUploadModalMotor] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalColorName, setModalColorName] = useState<string>('');
  const [customColorText, setCustomColorText] = useState<string>('');
  const [modalAddColorText, setModalAddColorText] = useState<string>('');
  const [isReplaceImage, setIsReplaceImage] = useState<boolean>(false);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<any[]>([]);

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

  const handleOpenAdd = () => {
    setEditingMotorcycle(null);
    setFormSku('');
    setFormName('');
    setFormBrandId(brands.length > 0 ? brands[0].id : '');
    setFormModel('');
    setFormYear(new Date().getFullYear());
    setFormCategory(categories[0] || 'Matic');
    setFormCondition('BARU');
    setFormPriceOtr('');
    setFormMinDp('');
    setFormStockStatus('TERSEDIA');
    setFormDescription('');
    setFormColors([]);
    setNewColorInput('');
    setFormError(null);
    setFormImageFile(null);
    setFormImagePreview(null);
    setExistingImages([]);
    setShowAddModal(true);
  };

  const handleOpenEdit = async (m: any) => {
    setEditingMotorcycle(m);
    setFormSku(m.sku || '');
    setFormName(m.name || '');
    setFormBrandId(m.brandId || (brands[0]?.id || ''));
    setFormModel(m.model || m.name || '');
    setFormYear(m.year || new Date().getFullYear());
    setFormCategory(m.category || 'Matic');
    setFormCondition(m.condition || 'BARU');
    setFormPriceOtr(String(m.priceOtr || ''));
    setFormMinDp(m.minDp !== null && m.minDp !== undefined ? String(m.minDp) : '');
    setFormStockStatus(m.stockStatus || 'TERSEDIA');
    setFormDescription(m.description || '');
    setFormColors(m.colors || []);
    setNewColorInput('');
    setFormError(null);
    setFormImageFile(null);
    setFormImagePreview(null);
    setExistingImages(m.images || []);
    setShowAddModal(true);

    try {
      const res = await apiRequest(`/motorcycles/${m.id}`);
      if (res.success && res.data) {
        setEditingMotorcycle(res.data);
        setExistingImages(res.data.images || []);
        setFormColors(res.data.colors || []);
      }
    } catch {}
  };

  const handleOpenUploadModal = async (m: any) => {
    setUploadModalMotor(m);
    try {
      const res = await apiRequest(`/motorcycles/${m.id}`);
      if (res.success && res.data) {
        setUploadModalMotor(res.data);
      }
    } catch {}
  };

  const handleSaveMotorcycle = async (e: React.FormEvent) => {
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
        colors: formColors,
        stockStatus: formStockStatus,
        isActive: true
      };

      let savedMotorId = editingMotorcycle?.id;
      if (editingMotorcycle) {
        const res = await apiRequest(`/motorcycles/${editingMotorcycle.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        if (!res.success) throw new Error(res.error || 'Gagal memperbarui data motor');
        savedMotorId = res.data?.id || editingMotorcycle.id;
      } else {
        const res = await apiRequest('/motorcycles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (!res.success) throw new Error(res.error || 'Gagal menyimpan motor');
        savedMotorId = res.data?.id;
      }

      // If user chose a new image in the form, upload and replace primary image
      if (formImageFile && savedMotorId) {
        const formData = new FormData();
        formData.append('images', formImageFile);
        await apiRequest(`/motorcycles/${savedMotorId}/images?replace=true`, {
          method: 'POST',
          body: formData
        });
      }

      setShowAddModal(false);
      setEditingMotorcycle(null);
      setFormImageFile(null);
      setFormImagePreview(null);
      loadData();
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
      const colorToSave = modalColorName === '__custom__' ? customColorText.trim() : modalColorName.trim();
      const formData = new FormData();
      formData.append('images', selectedFile);
      if (colorToSave) {
        formData.append('colorName', colorToSave);
      }

      await apiRequest(`/motorcycles/${uploadModalMotor.id}/images?replace=${isReplaceImage}`, {
        method: 'POST',
        body: formData
      });

      setSelectedFile(null);
      setModalColorName('');
      setCustomColorText('');
      setIsReplaceImage(false);

      const refreshRes = await apiRequest(`/motorcycles/${uploadModalMotor.id}`);
      if (refreshRes.success && refreshRes.data) {
        setUploadModalMotor(refreshRes.data);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModalImage = async (imageId: string) => {
    if (!uploadModalMotor || !confirm('Hapus foto ini?')) return;
    try {
      await apiRequest(`/motorcycles/${uploadModalMotor.id}/images/${imageId}`, {
        method: 'DELETE'
      });
      const refreshRes = await apiRequest(`/motorcycles/${uploadModalMotor.id}`);
      if (refreshRes.success && refreshRes.data) {
        setUploadModalMotor(refreshRes.data);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus gambar');
    }
  };

  const handleSetPrimaryModalImage = async (imageId: string) => {
    if (!uploadModalMotor) return;
    try {
      await apiRequest(`/motorcycles/${uploadModalMotor.id}/images/${imageId}/primary`, {
        method: 'PATCH'
      });
      const refreshRes = await apiRequest(`/motorcycles/${uploadModalMotor.id}`);
      if (refreshRes.success && refreshRes.data) {
        setUploadModalMotor(refreshRes.data);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah foto utama');
    }
  };

  const handleUpdateImageColor = async (imageId: string, newColor: string) => {
    if (!uploadModalMotor) return;
    try {
      await apiRequest(`/motorcycles/${uploadModalMotor.id}/images/${imageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ colorName: newColor })
      });
      const refreshRes = await apiRequest(`/motorcycles/${uploadModalMotor.id}`);
      if (refreshRes.success && refreshRes.data) {
        setUploadModalMotor(refreshRes.data);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui warna foto');
    }
  };

  const handleAddColorToMotor = async (newCol: string) => {
    if (!uploadModalMotor || !newCol.trim()) return;
    const clean = newCol.trim();
    const curColors = uploadModalMotor.colors || [];
    if (curColors.includes(clean)) return;
    const newColors = [...curColors, clean];
    try {
      const res = await apiRequest(`/motorcycles/${uploadModalMotor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ colors: newColors })
      });
      if (res.success) {
        setUploadModalMotor({ ...uploadModalMotor, colors: newColors });
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Gagal menambah varian warna');
    }
  };

  const handleDeleteColorFromMotor = async (colToDelete: string) => {
    if (!uploadModalMotor) return;
    const newColors = (uploadModalMotor.colors || []).filter((c: string) => c !== colToDelete);
    try {
      const res = await apiRequest(`/motorcycles/${uploadModalMotor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ colors: newColors })
      });
      if (res.success) {
        setUploadModalMotor({ ...uploadModalMotor, colors: newColors });
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Gagal menghapus varian warna');
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
            onClick={handleOpenAdd}
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

      {/* Table & Mobile Cards */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">SKU / Motor</th>
                <th className="py-3 px-4 whitespace-nowrap">Merek</th>
                <th className="py-3 px-4 whitespace-nowrap">Kategori &amp; Kondisi</th>
                <th className="py-3 px-4 whitespace-nowrap">Harga OTR</th>
                <th className="py-3 px-4 whitespace-nowrap">DP Min</th>
                <th className="py-3 px-4 whitespace-nowrap">Stok</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Varian &amp; Foto</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Memuat data motor...
                  </td>
                </tr>
              ) : motorcycles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenUploadModal(m)}
                        title="Klik untuk Kelola Varian Warna & Foto"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-xs transition-all hover:scale-[1.02] shadow-xs cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{m.images?.length || 0} Foto Varian</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          title="Edit Produk"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenUploadModal(m)}
                          title="Kelola Foto & Varian"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Memuat data motor...</div>
          ) : motorcycles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Belum ada motor yang sesuai filter.</div>
          ) : (
            motorcycles.map((m) => (
              <div key={m.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {m.images && m.images[0] ? (
                      <img src={m.images[0].url} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <Bike className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">{m.name}</h4>
                        <p className="font-mono text-[10px] text-slate-400">{m.sku}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        m.stockStatus === 'TERSEDIA'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {m.stockStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {m.brand?.name || '-'}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                        {m.category}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                        {m.condition}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Harga OTR</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatIDR(Number(m.priceOtr))}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">DP Minimal</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{m.minDp ? formatIDR(Number(m.minDp)) : '-'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenUploadModal(m)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-xs transition-colors"
                  >
                    <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{m.images?.length || 0} Foto Varian</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(m)}
                    title="Edit Produk"
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id, m.name)}
                    title="Hapus"
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 bg-slate-100 dark:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
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

      {/* Add / Edit Motor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingMotorcycle ? 'Edit Data Motor' : 'Tambah Motor Baru'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMotorcycle} className="p-5 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status Stok</label>
                  <select
                    value={formStockStatus}
                    onChange={(e) => setFormStockStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="TERSEDIA">TERSEDIA</option>
                    <option value="INDENT">INDENT</option>
                    <option value="HABIS">HABIS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Varian Warna Section */}
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-blue-600" />
                    <span>Varian Warna Motor ({formColors.length} varian)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Tekan Enter atau klik Tambah</span>
                </div>

                {/* Color Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  {formColors.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Belum ada varian warna ditambahkan. Ketik di bawah untuk menambah.</span>
                  ) : (
                    formColors.map((col, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
                      >
                        <span>{col}</span>
                        <button
                          type="button"
                          onClick={() => setFormColors(formColors.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-500 ml-0.5"
                          title="Hapus varian ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input Add Color */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: Deluxe Matte Black, Sporty Red..."
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newColorInput.trim() && !formColors.includes(newColorInput.trim())) {
                          setFormColors([...formColors, newColorInput.trim()]);
                          setNewColorInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newColorInput.trim() && !formColors.includes(newColorInput.trim())) {
                        setFormColors([...formColors, newColorInput.trim()]);
                        setNewColorInput('');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    + Tambah Warna
                  </button>
                </div>

                {editingMotorcycle && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Tersimpan {existingImages.length} foto varian warna
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setUploadModalMotor(editingMotorcycle);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Image className="w-3.5 h-3.5" />
                      <span>Buka Galeri & Upload Foto Tiap Warna</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Foto Produk Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Foto Produk
                </label>
                <div className="flex items-center gap-4 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {formImagePreview ? (
                      <img src={formImagePreview} alt="Preview baru" className="w-full h-full object-cover" />
                    ) : existingImages && existingImages.length > 0 ? (
                      <img src={existingImages[0].url} alt="Foto saat ini" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files ? e.target.files[0] : null;
                        setFormImageFile(file);
                        if (file) {
                          setFormImagePreview(URL.createObjectURL(file));
                        } else {
                          setFormImagePreview(null);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {formImageFile
                          ? `Foto baru dipilih (${(formImageFile.size / 1024).toFixed(1)} KB)`
                          : existingImages && existingImages.length > 0
                          ? 'Pilih foto baru untuk mengganti foto produk saat ini'
                          : 'Pilih foto motor untuk diunggah (PNG, JPG, WebP)'}
                      </span>
                      {formImageFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageFile(null);
                            setFormImagePreview(null);
                          }}
                          className="text-rose-500 hover:underline font-medium"
                        >
                          Batal Ganti
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Deskripsi / Spesifikasi & Pilihan Warna</label>
                <textarea
                  rows={4}
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
                  <span>{editingMotorcycle ? 'Simpan Perubahan' : 'Simpan Motor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload & Color Photo Management Modal */}
      {uploadModalMotor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Image className="w-4 h-4 text-blue-600" />
                  <span>Kelola Foto & Varian Warna</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {uploadModalMotor.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setUploadModalMotor(null);
                  setSelectedFile(null);
                  setModalColorName('');
                  setCustomColorText('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Varian Warna Chips Management */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-600" />
                  <span>Daftar Varian Warna Terdaftar ({uploadModalMotor.colors?.length || 0})</span>
                </span>
                <span className="text-[11px] text-slate-400">Klik tanda silang untuk menghapus</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(!uploadModalMotor.colors || uploadModalMotor.colors.length === 0) ? (
                  <span className="text-xs text-slate-400 italic">Belum ada varian warna. Ketik di bawah untuk menambahkan.</span>
                ) : (
                  uploadModalMotor.colors.map((c: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-xs"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColorFromMotor(c)}
                        className="text-slate-400 hover:text-rose-500"
                        title="Hapus varian warna ini"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Quick Add Color Form */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Ketik nama varian warna baru (contoh: Deluxe Matte Black)..."
                  value={modalAddColorText}
                  onChange={(e) => setModalAddColorText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (modalAddColorText.trim()) {
                        handleAddColorToMotor(modalAddColorText);
                        setModalAddColorText('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (modalAddColorText.trim()) {
                      handleAddColorToMotor(modalAddColorText);
                      setModalAddColorText('');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  + Tambah Warna
                </button>
              </div>
            </div>

            {/* List Existing Photos */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Foto Unit & Varian Warna Saat Ini ({uploadModalMotor.images?.length || 0})
              </span>

              {(!uploadModalMotor.images || uploadModalMotor.images.length === 0) ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                  Belum ada foto yang diunggah untuk motor ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                  {uploadModalMotor.images.map((img: any) => (
                    <div
                      key={img.id}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                        img.isPrimary
                          ? 'border-blue-500/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex gap-2.5 items-center">
                        <div className="w-16 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                          <img src={img.url} alt={img.colorName || 'Motor'} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-[11px] min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {img.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[9px]">
                                ⭐ Utama
                              </span>
                            )}
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {img.colorName ? `Warna: ${img.colorName}` : 'Tanpa Varian'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                            {img.url.split('/').pop()}
                          </p>
                        </div>
                      </div>

                      {/* Color assign & action buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <select
                          value={img.colorName || ''}
                          onChange={(e) => handleUpdateImageColor(img.id, e.target.value)}
                          className="text-[11px] py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 max-w-[130px] truncate"
                        >
                          <option value="">Tanpa Varian (Umum)</option>
                          {uploadModalMotor.colors && uploadModalMotor.colors.map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryModalImage(img.id)}
                              title="Jadikan Foto Utama"
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-blue-900/40 dark:text-slate-300 text-[10px] font-medium transition-colors"
                            >
                              Jadikan Utama
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteModalImage(img.id)}
                            title="Hapus Foto"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUploadImage} className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Tambah / Unggah Foto Baru
              </span>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {selectedFile ? (
                    <img src={URL.createObjectURL(selectedFile)} alt="Preview baru" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-white">
                    {selectedFile ? selectedFile.name : 'Pilih Berkas Foto'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Format JPG/PNG/WEBP (Maks 10MB)'}
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
              />

              {/* Color variant association */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Varian Warna Foto Ini:
                  </label>
                  <select
                    value={modalColorName}
                    onChange={(e) => setModalColorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  >
                    <option value="">Foto Utama (Tanpa Varian Khusus)</option>
                    {uploadModalMotor.colors && uploadModalMotor.colors.map((c: string) => (
                      <option key={c} value={c}>Varian: {c}</option>
                    ))}
                    <option value="__custom__">+ Ketik Nama Warna Sendiri...</option>
                  </select>
                </div>

                {modalColorName === '__custom__' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ketik Nama Varian:
                    </label>
                    <input
                      type="text"
                      value={customColorText}
                      onChange={(e) => setCustomColorText(e.target.value)}
                      placeholder="Contoh: Hard Rock Black"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Replace Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="replaceCheck"
                  checked={isReplaceImage}
                  onChange={(e) => setIsReplaceImage(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="replaceCheck" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Hapus semua foto lama dan ganti dengan foto ini sebagai foto utama
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadModalMotor(null);
                    setSelectedFile(null);
                    setModalColorName('');
                    setCustomColorText('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Unggah Foto</span>
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
