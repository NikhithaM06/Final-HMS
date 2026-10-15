import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Search,
  Filter,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Layers,
  Users,
  FileSpreadsheet
} from 'lucide-react';
import { fetchMembersByGeography, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';

export default function GeographyReport({
  hideNavHeader = false,
  initialGroupBy = 'district',
  lockGroupBy = null,
  title = null,
  subtitle = null,
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
  hideSearchInput = false,
}) {
  const [dataRows, setDataRows] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Geographic grouping: 'state' | 'district' | 'taluk' | 'village'
  const [groupBy, setGroupBy] = useState(lockGroupBy || initialGroupBy || 'district');

  // Filters supported by API
  const [stateFilter, setStateFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = propOnSearchChange || setInternalSearchQuery;

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const handleResetFilters = () => {
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
    notify('Filters reset.');
  };

  useEffect(() => {
    if (lockGroupBy) {
      setGroupBy(lockGroupBy);
    }
  }, [lockGroupBy]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchMembersByGeography({
        group_by: lockGroupBy || groupBy,
        state_id: stateFilter !== 'ALL' ? Number(stateFilter) : undefined,
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        taluk_id: talukFilter !== 'ALL' ? Number(talukFilter) : undefined,
      }),
      loadLocations(),
    ]).then(([geoRes, locRes]) => {
      if (cancelled) return;
      if (geoRes.status === 'fulfilled') {
        const raw = geoRes.value || [];
        setDataRows(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            groupName: r.group_name || r.name || r.location_name || r.district || r.taluk || r.state || r.village || 'Unspecified',
            stateName: r.state_name || r.state || '',
            districtName: r.district_name || r.district || '',
            talukName: r.taluk_name || r.taluk || '',
            villageName: r.village_name || r.village || '',
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
  }, [groupBy, lockGroupBy, stateFilter, districtFilter, talukFilter]);

  // Dependent Districts & Taluks
  const availableDistricts = useMemo(() => {
    if (stateFilter === 'ALL') return locations.districts;
    return locations.districts.filter((d) => String(d.stateId) === String(stateFilter));
  }, [locations.districts, stateFilter]);

  const availableTaluks = useMemo(() => {
    if (districtFilter === 'ALL') return locations.taluks;
    return locations.taluks.filter((t) => String(t.districtId) === String(districtFilter));
  }, [locations.taluks, districtFilter]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return dataRows;
    const q = searchQuery.toLowerCase().trim();
    return dataRows.filter((r) => String(r.groupName).toLowerCase().includes(q));
  }, [dataRows, searchQuery]);

  const totalMembers = useMemo(() => {
    return dataRows.reduce((sum, r) => sum + r.memberCount, 0);
  }, [dataRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Excel Export (.xlsx)
  const handleExportExcel = () => {
    try {
      const success = exportRowsToExcel(
        [
          { key: 'slNo', label: 'Sl No' },
          { key: 'groupName', label: `Geographic Unit (${groupBy.toUpperCase()})` },
          { key: 'memberCount', label: 'Total Members' },
          { key: 'approvedCount', label: 'Approved Members' },
          { key: 'unapprovedCount', label: 'Unapproved Members' },
        ],
        filteredRows,
        `members_by_geography_${groupBy}_${new Date().toISOString().slice(0, 10)}.xlsx`
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
            {title || (lockGroupBy === 'district' ? 'District-wise Members Report' : lockGroupBy === 'taluk' ? 'Taluk-wise Members Report' : 'Members by Geography')}
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

      {/* Grouping Level Tabs (Hidden if locked to a single aggregate view) */}
      {!lockGroupBy && (
        <div className="bg-[#FAF7F2] p-2 rounded-2xl border border-[#E8DFD8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#510601] ml-2" />
            <span className="text-xs font-bold text-[#180200]">Aggregate By:</span>
            <div className="inline-flex rounded-xl border border-[#E8DFD8] p-1 bg-white">
              {[
                { id: 'state', label: 'State-wise' },
                { id: 'district', label: 'District-wise' },
                { id: 'taluk', label: 'Taluk-wise' },
                { id: 'village', label: 'Village-wise' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => {
                    setGroupBy(lvl.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    groupBy === lvl.id
                      ? 'bg-[#510601] text-white shadow-xs'
                      : 'text-[#863221] hover:text-[#510601]'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-[#863221] font-semibold pr-2">
            Total Members in View: <span className="text-[#510601] font-bold">{totalMembers}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
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
              placeholder={`Search ${groupBy} name...`}
              className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#863221] mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Regional Filters:</span>
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
        {groupBy !== 'district' && (
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
        )}

        {/* Reset Action */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-200/80 text-[#863221] text-xs font-semibold rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                <th className="py-3 px-4">Sl No</th>
                <th className="py-3 px-4 capitalize">{groupBy} Name</th>
                <th className="py-3 px-4 text-right">Total Members</th>
                <th className="py-3 px-4 text-right">Approved</th>
                <th className="py-3 px-4 text-right">Pending / Unapproved</th>
                <th className="py-3 px-4 text-right">Share of Roster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#863221]">
                    Aggregating geographic report…
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#863221]">
                    No geographic records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const share = totalMembers > 0 ? ((r.memberCount / totalMembers) * 100).toFixed(1) : '0';
                  return (
                    <tr key={r.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                      <td className="py-3 px-4 font-bold text-[#180200] flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#863221]/60 shrink-0" />
                        <span>{r.groupName}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#510601]">
                        {r.memberCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        {r.approvedCount || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700 font-semibold">
                        {r.unapprovedCount || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#863221]">
                        {share}%
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
            {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} units
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
