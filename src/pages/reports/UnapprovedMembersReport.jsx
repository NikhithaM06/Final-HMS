import React, { useState, useEffect, useMemo } from 'react';
import {
  UserX,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { fetchUnapprovedMembersReport, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';

const UNAPPROVED_COLUMNS = [
  { key: 'slNo', label: 'Sl No' },
  { key: 'id', label: 'App ID' },
  { key: 'name', label: 'Applicant Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'gender', label: 'Gender' },
  { key: 'district', label: 'District' },
  { key: 'taluk', label: 'Taluk' },
  { key: 'registrationSource', label: 'Source' },
  { key: 'registeredDate', label: 'Application Date' },
  { key: 'approvalStatus', label: 'Approval Status' },
];

export default function UnapprovedMembersReport({
  hideNavHeader = false,
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
  hideSearchInput = false,
  hideInternalFilters = false,
  districtFilter: propDistrictFilter = 'ALL',
  talukFilter: propTalukFilter = 'ALL',
  genderFilter: propGenderFilter = 'ALL',
  locations: propLocations = null,
}) {
  const [records, setRecords] = useState([]);
  const [internalLocations, setInternalLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Filters supported by API
  const [stateFilter, setStateFilter] = useState('ALL');
  const [internalDistrictFilter, setInternalDistrictFilter] = useState('ALL');
  const [internalTalukFilter, setInternalTalukFilter] = useState('ALL');
  const [internalGenderFilter, setInternalGenderFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = propOnSearchChange || setInternalSearchQuery;
  const districtFilter = propDistrictFilter !== undefined ? propDistrictFilter : internalDistrictFilter;
  const setDistrictFilter = setInternalDistrictFilter;
  const talukFilter = propTalukFilter !== undefined ? propTalukFilter : internalTalukFilter;
  const setTalukFilter = setInternalTalukFilter;
  const genderFilter = propGenderFilter !== undefined ? propGenderFilter : internalGenderFilter;
  const locations = propLocations || internalLocations;

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const handleResetFilters = () => {
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setInternalGenderFilter('ALL');
    setSourceFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setCurrentPage(1);
    notify('Filters reset.');
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchUnapprovedMembersReport({
        state_id: stateFilter !== 'ALL' ? Number(stateFilter) : undefined,
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        taluk_id: talukFilter !== 'ALL' ? Number(talukFilter) : undefined,
        registration_source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        registered_from: fromDate || undefined,
        registered_to: toDate || undefined,
      }),
      propLocations ? Promise.resolve(propLocations) : loadLocations(),
    ]).then(([unappRes, locRes]) => {
      if (cancelled) return;
      if (unappRes.status === 'fulfilled') {
        const raw = unappRes.value || [];
        setRecords(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            id: r.id || r.member_id || r.application_id,
            name: r.full_name_en || r.name || [r.first_name_en, r.last_name_en].filter(Boolean).join(' ') || r.full_name_kn || '—',
            mobile: r.mobile || r.phone || '—',
            email: r.email || '—',
            district: r.district_name || r.district || '—',
            districtId: r.district_id || '',
            taluk: r.taluk_name || r.taluk || '—',
            talukId: r.taluk_id || '',
            gender: r.gender || r.category_gender || '',
            registrationSource: r.registration_source || 'OFFLINE',
            registeredDate: r.created_at || r.registration_date || r.date || '',
            approvalStatus: r.approval_status || r.status || 'UNAPPROVED',
          }))
        );
      }
      if (locRes.status === 'fulfilled' && !propLocations) setInternalLocations(locRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [stateFilter, districtFilter, talukFilter, sourceFilter, fromDate, toDate, propLocations]);

  // Dependent Districts
  const availableDistricts = useMemo(() => {
    if (stateFilter === 'ALL') return locations.districts;
    return locations.districts.filter((d) => String(d.stateId) === String(stateFilter));
  }, [locations.districts, stateFilter]);

  // Dependent Taluks
  const availableTaluks = useMemo(() => {
    if (districtFilter === 'ALL') {
      if (stateFilter === 'ALL') return locations.taluks;
      return locations.taluks.filter((t) => String(t.stateId) === String(stateFilter));
    }
    return locations.taluks.filter((t) => String(t.districtId) === String(districtFilter));
  }, [locations.taluks, districtFilter, stateFilter]);

  // Filtered by District, Taluk, Gender and Search
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. District filter (client check to ensure exact match)
      if (districtFilter && districtFilter !== 'ALL') {
        const dId = String(r.districtId || '');
        const dName = String(r.district || '').toLowerCase();
        const selectedDist = (locations.districts || []).find((d) => String(d.id) === String(districtFilter));
        const targetName = selectedDist ? selectedDist.name.toLowerCase() : '';
        const matchesDistrict = dId === String(districtFilter) || (targetName && dName === targetName);
        if (!matchesDistrict) return false;
      }

      // 2. Taluk filter
      if (talukFilter && talukFilter !== 'ALL') {
        const tId = String(r.talukId || '');
        const tName = String(r.taluk || '').toLowerCase();
        const selectedTaluk = (locations.taluks || []).find((t) => String(t.id) === String(talukFilter));
        const targetName = selectedTaluk ? selectedTaluk.name.toLowerCase() : '';
        const matchesTaluk = tId === String(talukFilter) || (targetName && tName === targetName);
        if (!matchesTaluk) return false;
      }

      // 3. Gender filter
      if (genderFilter && genderFilter !== 'ALL') {
        const rGender = String(r.gender || '').trim().toLowerCase();
        const filterG = String(genderFilter).trim().toLowerCase();
        if (filterG === 'male') {
          if (rGender !== 'male') return false;
        } else if (filterG === 'female') {
          if (rGender !== 'female') return false;
        } else {
          // Other
          if (rGender === 'male' || rGender === 'female' || !rGender) return false;
        }
      }

      // 4. Search query
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(r.name).toLowerCase().includes(q);
        const matchesId = String(r.id).toLowerCase().includes(q);
        const matchesMobile = String(r.mobile).includes(q);
        const matchesDistrict = String(r.district).toLowerCase().includes(q);
        const matchesTaluk = String(r.taluk).toLowerCase().includes(q);
        const matchesGender = String(r.gender).toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesMobile && !matchesDistrict && !matchesTaluk && !matchesGender) {
          return false;
        }
      }

      return true;
    });
  }, [records, searchQuery, districtFilter, talukFilter, genderFilter, locations]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, districtFilter, talukFilter, genderFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const success = exportRowsToExcel(
        UNAPPROVED_COLUMNS,
        filteredRecords,
        `unapproved_members_${new Date().toISOString().slice(0, 10)}.xlsx`
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
          <h2 className="text-lg sm:text-xl font-bold text-[#180200] tracking-tight flex items-center gap-2">
            <span>Unapproved Members</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'}
            </span>
          </h2>
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

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Total Unapproved</span>
          <strong className="text-2xl font-bold text-amber-700 mt-1 block">
            {loading ? '—' : records.length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Online Applications</span>
          <strong className="text-2xl font-bold text-[#180200] mt-1 block">
            {loading ? '—' : filteredRecords.filter((r) => r.registrationSource === 'ONLINE').length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Offline Applications</span>
          <strong className="text-2xl font-bold text-[#180200] mt-1 block">
            {loading ? '—' : filteredRecords.filter((r) => r.registrationSource !== 'ONLINE').length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Matching Active Filters</span>
          <strong className="text-2xl font-bold text-[#510601] mt-1 block">
            {loading ? '—' : filteredRecords.length}
          </strong>
        </div>
      </div>

      {/* Filter Bar (Shown only in standalone view when hideInternalFilters is false) */}
      {!hideInternalFilters && (
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center gap-3">
          {/* Search */}
          {!hideSearchInput ? (
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search pending applicants..."
                className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#863221] mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Audit & Verification Filters:</span>
            </div>
          )}

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setDistrictFilter('ALL');
              setTalukFilter('ALL');
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All States</option>
            {locations.states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

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
            {availableDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Taluk Filter */}
          <select
            value={talukFilter}
            onChange={(e) => {
              setTalukFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Taluks</option>
            {availableTaluks.map((tk) => (
              <option key={tk.id} value={tk.id}>
                {tk.name}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="OFFLINE">Offline Application</option>
            <option value="ONLINE">Public Portal / Online</option>
          </select>

          {/* Date From & To */}
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
            <span className="text-[11px] font-semibold text-[#863221]">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-xs text-[#180200] focus:outline-none cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
            <span className="text-[11px] font-semibold text-[#863221]">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-xs text-[#180200] focus:outline-none cursor-pointer"
            />
          </div>

          {/* Reset Action */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-200/80 text-[#863221] text-xs font-semibold rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                {UNAPPROVED_COLUMNS.map((col) => (
                  <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={UNAPPROVED_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    Loading unapproved applications…
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={UNAPPROVED_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    No unapproved members match the current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => (
                  <tr key={r.id || r.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#510601]">#{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#180200]">{r.name}</td>
                    <td className="py-3 px-4 text-[#180200]">{r.mobile}</td>
                    <td className="py-3 px-4 text-[#180200]">{r.gender || '—'}</td>
                    <td className="py-3 px-4 text-[#180200]">{r.district}</td>
                    <td className="py-3 px-4 text-[#180200]">{r.taluk}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF7F2] border border-[#E8DFD8] text-[#863221]">
                        {r.registrationSource}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#180200] whitespace-nowrap">
                      {formatDate(r.registeredDate) || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Approval</span>
                      </span>
                    </td>
                  </tr>
                ))
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
