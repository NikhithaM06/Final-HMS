import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  X,
  ExternalLink,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  fetchSavedReports,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport
} from '../../utils/reportApi';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';
import Modal from '../../components/Modal';

const REPORT_KEYS = [
  { key: 'members', label: 's Report' },
  { key: 'unapproved_members', label: 'Unapproved Members Report' },
  { key: 'geography', label: 'Members by Geography Report' },
  { key: 'gender', label: 'Members by Gender Report' },
  { key: 'membership_type', label: 'Members by Membership Type Report' },
  { key: 'labels', label: 'Labels Report' },
  { key: 'magazine_returns', label: 'Magazine Returns Report' },
  { key: 'receipts', label: 'Receipt Reports' },
  { key: 'receipts_by_member', label: 'Receipt Reports by Member' },
];

export default function SavedReports() {
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    report_key: 'members',
    language: 'en',
    is_shared: false,
    filtersStr: '{}',
    columnsStr: '{}',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchSavedReports({ page, limit: 50 })
      .then((data) => {
        setSavedReports(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        notify(err.response?.data?.detail || 'Failed to load saved reports from server.', 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentId(null);
    setFormData({
      name: '',
      report_key: 'members',
      language: 'en',
      is_shared: false,
      filtersStr: '{\n  "district_id": null\n}',
      columnsStr: '{\n  "visible_columns": ["slNo", "memberId", "name", "mobile", "status"]\n}',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (report) => {
    setModalMode('edit');
    setCurrentId(report.id);
    setFormData({
      name: report.name || '',
      report_key: report.report_key || 'members',
      language: report.language || 'en',
      is_shared: Boolean(report.is_shared),
      filtersStr: JSON.stringify(report.filters || {}, null, 2),
      columnsStr: JSON.stringify(report.columns_config || {}, null, 2),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify('Report name is required.', 'error');
      return;
    }

    let parsedFilters = {};
    let parsedColumns = {};
    try {
      if (formData.filtersStr.trim()) parsedFilters = JSON.parse(formData.filtersStr);
    } catch {
      notify('Filters must be valid JSON.', 'error');
      return;
    }
    try {
      if (formData.columnsStr.trim()) parsedColumns = JSON.parse(formData.columnsStr);
    } catch {
      notify('Columns configuration must be valid JSON.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await createSavedReport({
          name: formData.name.trim(),
          report_key: formData.report_key,
          language: formData.language,
          is_shared: formData.is_shared,
          filters: parsedFilters,
          columns_config: parsedColumns,
        });
        notify('Saved report configuration created successfully.');
      } else {
        await updateSavedReport(currentId, {
          name: formData.name.trim(),
          language: formData.language,
          is_shared: formData.is_shared,
          filters: parsedFilters,
          columns_config: parsedColumns,
        });
        notify('Saved report configuration updated successfully.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      notify(err.response?.data?.detail || 'Operation failed on server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSavedReport(deleteTarget.id);
      notify(`Saved report "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      notify(err.response?.data?.detail || 'Failed to delete saved report.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered view
  const filteredList = savedReports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      String(r.name).toLowerCase().includes(q) ||
      String(r.report_key).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Saved Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
            Manage reusable report templates, filter presets, and custom print configurations stored on the server.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Save New Report Template</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved report templates..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
          />
        </div>
        <span className="text-xs text-[#863221] font-semibold">
          {filteredList.length} templates saved
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                <th className="py-3 px-4">Template Name</th>
                <th className="py-3 px-4">Report Type</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Saved On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#863221]">
                    Loading saved reports from server…
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#863221]">
                    No saved report configurations found. Click "Save New Report Template" to create one.
                  </td>
                </tr>
              ) : (
                filteredList.map((r) => {
                  const repLabel = REPORT_KEYS.find((k) => k.key === r.report_key)?.label || r.report_key;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#180200]">{r.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF7F2] border border-[#E8DFD8] text-[#863221]">
                          {repLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 uppercase font-semibold text-xs text-[#510601]">
                        {r.language || 'EN'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${r.is_shared ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-stone-50 text-stone-600 border-stone-200'
                          }`}>
                          {r.is_shared ? 'Shared / Global' : 'Private'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#863221] whitespace-nowrap">
                        {formatDate(r.created_at) || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                            title="Edit Saved Report"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                            title="Delete Saved Report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Save New Report Template' : 'Edit Saved Report Template'}
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#180200] block mb-1">Template Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Bengaluru Life Members Print"
              className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#180200] block mb-1">Report Module *</label>
              <select
                disabled={modalMode === 'edit'}
                value={formData.report_key}
                onChange={(e) => setFormData({ ...formData, report_key: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs text-[#180200] focus:outline-none cursor-pointer disabled:opacity-60"
              >
                {REPORT_KEYS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#180200] block mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs text-[#180200] focus:outline-none cursor-pointer"
              >
                <option value="en">English (en)</option>
                <option value="kn">Kannada (kn)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#180200] block mb-1">Filter Preset (JSON)</label>
            <textarea
              rows={3}
              value={formData.filtersStr}
              onChange={(e) => setFormData({ ...formData, filtersStr: e.target.value })}
              className="w-full font-mono text-xs p-2.5 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#510601]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#180200] block mb-1">Columns Configuration (JSON)</label>
            <textarea
              rows={3}
              value={formData.columnsStr}
              onChange={(e) => setFormData({ ...formData, columnsStr: e.target.value })}
              className="w-full font-mono text-xs p-2.5 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#510601]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#180200] cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_shared}
              onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
              className="accent-[#510601]"
            />
            <span>Make this template available to all staff users (Shared)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8DFD8]">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#863221] hover:bg-[#FAF7F2] rounded-xl border border-[#E8DFD8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40"
            >
              {submitting ? 'Saving to server…' : modalMode === 'create' ? 'Save Configuration' : 'Update Configuration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Confirm Deletion"
      >
        <div className="p-4 space-y-4">
          <p className="text-xs sm:text-sm text-[#180200]">
            Are you sure you want to permanently delete the saved report configuration{' '}
            <strong className="text-[#510601]">"{deleteTarget?.name}"</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8DFD8]">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-xs font-bold text-[#863221] hover:bg-[#FAF7F2] rounded-xl border border-[#E8DFD8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete Configuration'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
