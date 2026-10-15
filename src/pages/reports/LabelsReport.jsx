import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Printer
} from 'lucide-react';
import { fetchLabelsReport, exportRowsToCsv } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';

const LABEL_COLUMNS = [
  { key: 'slNo', label: 'Sl No' },
  { key: 'memberId', label: 'Member ID' },
  { key: 'name', label: 'Member Name' },
  { key: 'address', label: 'Dispatch Address' },
  { key: 'district', label: 'District' },
  { key: 'taluk', label: 'Taluk' },
  { key: 'batchId', label: 'Batch ID' },
  { key: 'issueMonth', label: 'Issue Month' },
  { key: 'status', label: 'Label Status' },
];

export default function LabelsReport({ hideNavHeader = false }) {
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Filters supported by API
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'pending' | 'generated'
  const [monthFilter, setMonthFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchLabelsReport({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        issue_month_year: monthFilter || undefined,
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        taluk_id: talukFilter !== 'ALL' ? Number(talukFilter) : undefined,
      }),
      loadLocations(),
    ]).then(([repRes, locRes]) => {
      if (cancelled) return;
      if (repRes.status === 'fulfilled') {
        const raw = repRes.value || [];
        setRecords(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            memberId: r.member_code || r.membership_number || r.member_id || r.id,
            name: r.member_name || r.name || r.full_name_en || '—',
            address: r.address || [r.address_line1, r.locality, r.city, r.pincode].filter(Boolean).join(', ') || '—',
            district: r.district_name || r.district || '—',
            districtId: r.district_id || '',
            taluk: r.taluk_name || r.taluk || '—',
            talukId: r.taluk_id || '',
            batchId: r.batch_id || r.label_batch_id || '—',
            issueMonth: r.issue_month_year || r.issue_month || '—',
            status: r.status || (r.batch_id ? 'generated' : 'pending'),
          }))
        );
      }
      if (locRes.status === 'fulfilled') setLocations(locRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, monthFilter, districtFilter, talukFilter]);

  // Search filter
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((r) => {
      return (
        String(r.name).toLowerCase().includes(q) ||
        String(r.memberId).toLowerCase().includes(q) ||
        String(r.district).toLowerCase().includes(q) ||
        String(r.address).toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // CSV Export
  const handleExportCsv = () => {
    try {
      const success = exportRowsToCsv(
        LABEL_COLUMNS,
        filteredRecords,
        `labels_report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      if (success) notify('CSV exported successfully.');
    } catch {
      notify('Export failed.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const pendingCount = useMemo(() => records.filter((r) => r.status === 'pending').length, [records]);
  const generatedCount = useMemo(() => records.filter((r) => r.status === 'generated').length, [records]);

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Labels Report (Pending / Generated)
          </h1>
          <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
            Audit log of magazine dispatch labels categorized by pending eligibility and batch-generated state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Total Records</span>
          <strong className="text-2xl font-bold text-[#180200] mt-1 block">
            {loading ? '—' : records.length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Pending Labels</span>
          <strong className="text-2xl font-bold text-amber-700 mt-1 block">
            {loading ? '—' : pendingCount}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Generated Batches</span>
          <strong className="text-2xl font-bold text-emerald-800 mt-1 block">
            {loading ? '—' : generatedCount}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Matching Filters</span>
          <strong className="text-2xl font-bold text-[#510601] mt-1 block">
            {loading ? '—' : filteredRecords.length}
          </strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search member, ID, or address..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="generated">Generated</option>
        </select>

        {/* Issue Month */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
          <span className="text-[11px] font-semibold text-[#863221]">Month:</span>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-transparent border-none text-xs text-[#180200] focus:outline-none cursor-pointer"
          />
        </div>

        {/* District Filter */}
        <select
          value={districtFilter}
          onChange={(e) => {
            setDistrictFilter(e.target.value);
            setTalukFilter('ALL');
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Districts</option>
          {locations.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                {LABEL_COLUMNS.map((col) => (
                  <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={LABEL_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    Loading label records…
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={LABEL_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    No label records match the current filter.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const isGenerated = r.status === 'generated';
                  return (
                    <tr key={r.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#510601]">{r.memberId}</td>
                      <td className="py-3 px-4 font-semibold text-[#180200]">{r.name}</td>
                      <td className="py-3 px-4 text-[#180200] max-w-xs truncate" title={r.address}>
                        {r.address}
                      </td>
                      <td className="py-3 px-4 text-[#180200]">{r.district}</td>
                      <td className="py-3 px-4 text-[#180200]">{r.taluk}</td>
                      <td className="py-3 px-4 font-mono text-[#863221]">{r.batchId}</td>
                      <td className="py-3 px-4 font-mono text-[#180200]">{r.issueMonth}</td>
                      <td className="py-3 px-4">
                        {isGenerated ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Generated</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[#E8DFD8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#863221]">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1.5 rounded-lg border border-[#E8DFD8] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-[#180200]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-[#E8DFD8] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
