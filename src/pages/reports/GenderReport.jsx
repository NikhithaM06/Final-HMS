import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  PieChart,
  FileSpreadsheet
} from 'lucide-react';
import { fetchMembersByGender, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';

export default function GenderReport({
  hideNavHeader = false,
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
  hideSearchInput = false,
}) {
  const [dataRows, setDataRows] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Filters
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = propOnSearchChange || setInternalSearchQuery;

  const handleResetFilters = () => {
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    notify('Filters reset.');
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchMembersByGender({
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        taluk_id: talukFilter !== 'ALL' ? Number(talukFilter) : undefined,
        approval_status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
      loadLocations(),
    ]).then(([genRes, locRes]) => {
      if (cancelled) return;
      if (genRes.status === 'fulfilled') {
        const raw = genRes.value || [];
        setDataRows(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            gender: r.gender || r.category || 'Unspecified / Missing',
            memberCount: Number(r.member_count || r.count || r.total || 0),
            approvedCount: Number(r.approved_count || r.approved || 0),
            unapprovedCount: Number(r.unapproved_count || r.unapproved || 0),
          }))
        );
      }
      if (locRes.status === 'fulfilled') setLocations(locRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [districtFilter, talukFilter, statusFilter]);

  const totalMembers = useMemo(() => {
    return dataRows.reduce((sum, r) => sum + r.memberCount, 0);
  }, [dataRows]);

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const success = exportRowsToExcel(
        [
          { key: 'slNo', label: 'Sl No' },
          { key: 'gender', label: 'Gender Category' },
          { key: 'memberCount', label: 'Total Count' },
          { key: 'approvedCount', label: 'Approved Count' },
          { key: 'unapprovedCount', label: 'Pending / Unapproved' },
        ],
        dataRows,
        `members_by_gender_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      if (success) notify('Exported to Excel successfully (.xlsx).');
      else notify('No records to export.', 'error');
    } catch {
      notify('Export failed.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Gender-wise Members Report
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            title="Export to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Search */}
        {!hideSearchInput ? (
          <div className="relative w-full sm:w-48 md:w-52 shrink-0">
            <Search className="w-4 h-4 text-[#863221]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#180200] placeholder-[#863221]/40 focus:outline-none focus:ring-1 focus:ring-[#510601] shadow-2xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#863221] mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Demographic Filters:</span>
          </div>
        )}

        {/* District Filter */}
        <div className="relative">
          <select
            value={districtFilter}
            onChange={(e) => {
              setDistrictFilter(e.target.value);
              setTalukFilter('ALL');
            }}
            className="appearance-none pl-3.5 pr-8 py-2 bg-white hover:bg-[#FAF7F2]/60 border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601] cursor-pointer shadow-2xs font-medium"
          >
            <option value="ALL">All Districts</option>
            {locations.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Taluk Filter */}
        <div className="relative">
          <select
            value={talukFilter}
            onChange={(e) => setTalukFilter(e.target.value)}
            className="appearance-none pl-3.5 pr-8 py-2 bg-white hover:bg-[#FAF7F2]/60 border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601] cursor-pointer shadow-2xs font-medium"
          >
            <option value="ALL">All Taluks</option>
            {locations.taluks
              .filter((t) => districtFilter === 'ALL' || String(t.districtId) === String(districtFilter))
              .map((tk) => (
                <option key={tk.id} value={tk.id}>
                  {tk.name}
                </option>
              ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3.5 pr-8 py-2 bg-white hover:bg-[#FAF7F2]/60 border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601] cursor-pointer shadow-2xs font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved Only</option>
            <option value="UNAPPROVED">Unapproved / Pending</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Reset Action */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#863221] hover:text-[#510601] text-xs sm:text-sm font-medium rounded-2xl border border-[#E8DFD8] hover:border-[#863221]/40 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#863221]" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dataRows.map((r) => {
          const share = totalMembers > 0 ? ((r.memberCount / totalMembers) * 100).toFixed(1) : '0';
          const isMale = r.gender.toLowerCase().includes('male') && !r.gender.toLowerCase().includes('female');
          const isFemale = r.gender.toLowerCase().includes('female');
          return (
            <div key={r.gender} className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#863221] uppercase tracking-wider block">
                  {r.gender}
                </span>
                <strong className={`text-3xl font-bold mt-2 block ${isMale ? 'text-sky-800' : isFemale ? 'text-emerald-800' : 'text-[#510601]'}`}>
                  {r.memberCount}
                </strong>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E8DFD8] flex items-center justify-between text-xs text-[#863221]">
                <span>Approved: <strong className="text-[#180200]">{r.approvedCount || 0}</strong></span>
                <span className="font-semibold font-mono bg-[#FAF7F2] px-2 py-0.5 rounded-full border border-[#E8DFD8]">{share}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
            <tr>
              <th className="py-3 px-4">Sl No</th>
              <th className="py-3 px-4">Gender Classification</th>
              <th className="py-3 px-4 text-right">Total Count</th>
              <th className="py-3 px-4 text-right">Approved</th>
              <th className="py-3 px-4 text-right">Unapproved / Pending</th>
              <th className="py-3 px-4 text-right">Percentage Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8DFD8]">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#863221]">
                  Loading gender demographics…
                </td>
              </tr>
            ) : dataRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#863221]">
                  No gender demographic data found.
                </td>
              </tr>
            ) : (
              dataRows.map((r) => {
                const share = totalMembers > 0 ? ((r.memberCount / totalMembers) * 100).toFixed(1) : '0';
                return (
                  <tr key={r.gender} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                    <td className="py-3 px-4 font-bold text-[#180200]">{r.gender}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#510601]">{r.memberCount}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">{r.approvedCount || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700 font-semibold">{r.unapprovedCount || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#863221] font-semibold">{share}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
