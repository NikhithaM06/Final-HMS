import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Search,
  Filter,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Users,
  ArrowLeft,
  RotateCcw,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { fetchMembersByMembershipType, fetchMembersReport, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadMembershipTypes, loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';

export default function MembershipTypeReport({ hideNavHeader = false }) {
  const [dataRows, setDataRows] = useState([]);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Filters for Summary View
  const [typeIdFilter, setTypeIdFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drilldown: Selected Membership Type
  const [selectedType, setSelectedType] = useState(null);
  const [typeMembers, setTypeMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const memberPageSize = 20;

  // Load Membership Type aggregates & Masters
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchMembersByMembershipType({
        membership_type_id: typeIdFilter !== 'ALL' ? Number(typeIdFilter) : undefined,
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        active_only: activeOnly,
      }),
      loadMembershipTypes(),
      loadLocations(),
    ]).then(([typeRepRes, typesRes, locRes]) => {
      if (cancelled) return;
      if (typeRepRes.status === 'fulfilled') {
        const raw = typeRepRes.value || [];
        setDataRows(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            typeName: r.type_name || r.name || r.membership_type || 'Unspecified Type',
            typeCode: r.type_code || r.code || '',
            currentPrice: Number(r.current_price || r.price || 0),
            memberCount: Number(r.member_count || r.count || r.total || 0),
            activeCount: Number(r.active_count || r.active || 0),
            inactiveCount: Number(r.inactive_count || r.inactive || 0),
          }))
        );
      }
      if (typesRes.status === 'fulfilled') setMembershipTypes(typesRes.value);
      if (locRes.status === 'fulfilled') setLocations(locRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [typeIdFilter, districtFilter, activeOnly]);

  // Load members when a membership type is selected
  useEffect(() => {
    if (!selectedType) {
      setTypeMembers([]);
      return;
    }

    let cancelled = false;
    setLoadingMembers(true);
    setMemberSearchQuery('');
    setMemberPage(1);

    fetchMembersReport({
      membership_type: selectedType.typeName,
      district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
    })
      .then((raw) => {
        if (cancelled) return;
        const list = Array.isArray(raw) ? raw : [];
        setTypeMembers(
          list.map((m, idx) => ({
            ...m,
            slNo: idx + 1,
            memberId: m.member_code || m.membership_number || m.id,
            name: m.full_name_en || m.name || [m.first_name_en, m.last_name_en].filter(Boolean).join(' ') || '—',
            mobile: m.mobile || m.phone || '—',
            district: m.district_name || m.district || '—',
            taluk: m.taluk_name || m.taluk || '—',
            village: m.village || m.place || '—',
            gender: m.gender || '—',
            status: m.member_status || m.status || 'Active',
          }))
        );
        setLoadingMembers(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedType, districtFilter]);

  const totalMembers = useMemo(() => {
    return dataRows.reduce((sum, r) => sum + r.memberCount, 0);
  }, [dataRows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return dataRows;
    const q = searchQuery.toLowerCase().trim();
    return dataRows.filter((r) => r.typeName.toLowerCase().includes(q) || r.typeCode.toLowerCase().includes(q));
  }, [dataRows, searchQuery]);

  // Filtered associated members
  const filteredTypeMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return typeMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return typeMembers.filter(
      (m) =>
        String(m.name).toLowerCase().includes(q) ||
        String(m.memberId).toLowerCase().includes(q) ||
        String(m.mobile).includes(q) ||
        String(m.district).toLowerCase().includes(q) ||
        String(m.taluk).toLowerCase().includes(q)
    );
  }, [typeMembers, memberSearchQuery]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredTypeMembers.length / memberPageSize));
  const paginatedTypeMembers = useMemo(() => {
    const start = (memberPage - 1) * memberPageSize;
    return filteredTypeMembers.slice(start, start + memberPageSize);
  }, [filteredTypeMembers, memberPage, memberPageSize]);

  // Reset filters
  const handleResetFilters = () => {
    setTypeIdFilter('ALL');
    setDistrictFilter('ALL');
    setActiveOnly(false);
    setSearchQuery('');
    notify('Filters reset.');
  };

  // Export Excel (.xlsx)
  const handleExportSummaryExcel = () => {
    try {
      const success = exportRowsToExcel(
        [
          { key: 'slNo', label: 'Sl No' },
          { key: 'typeName', label: 'Membership Type' },
          { key: 'typeCode', label: 'Code' },
          { key: 'memberCount', label: 'Total Enrolled' },
          { key: 'activeCount', label: 'Active Members' },
          { key: 'inactiveCount', label: 'Inactive' },
          { key: 'currentPrice', label: 'Current Price (₹)' },
        ],
        filteredRows,
        `membership_types_summary_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      if (success) notify('Summary Excel exported successfully (.xlsx).');
      else notify('No records to export.', 'error');
    } catch {
      notify('Export failed.', 'error');
    }
  };

  const handleExportMembersExcel = () => {
    try {
      const success = exportRowsToExcel(
        [
          { key: 'slNo', label: 'Sl No' },
          { key: 'memberId', label: 'Membership No' },
          { key: 'name', label: 'Member Name' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'district', label: 'District' },
          { key: 'taluk', label: 'Taluk' },
          { key: 'village', label: 'Village' },
          { key: 'gender', label: 'Gender' },
          { key: 'status', label: 'Status' },
        ],
        filteredTypeMembers,
        `${selectedType?.typeName || 'members'}_roster_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      if (success) notify('Member roster Excel exported successfully (.xlsx).');
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
          {selectedType ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="p-2 rounded-xl bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                title="Back to All Membership Types"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight flex items-center gap-2">
                  <span>{selectedType.typeName}</span>
                  <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {typeMembers.length} Members
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
                  Roster of members enrolled under this membership category.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
                Membership Type Report
              </h1>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectedType ? handleExportMembersExcel : handleExportSummaryExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            title="Export directly to Excel (.xlsx)"
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

      {/* VIEW A: DRILLDOWN ASSOCIATED MEMBERS TABLE */}
      {selectedType ? (
        <div className="space-y-4">
          {/* Member Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => {
                  setMemberSearchQuery(e.target.value);
                  setMemberPage(1);
                }}
                placeholder="Search member by name, ID, mobile, or place..."
                className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#863221] font-semibold">
                Showing {filteredTypeMembers.length} matching of {typeMembers.length}
              </span>
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-200/80 text-[#863221] text-xs font-semibold rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
              >
                Back to All Types
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
                  <tr>
                    <th className="py-3 px-4">Sl No</th>
                    <th className="py-3 px-4">Membership No</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">Taluk</th>
                    <th className="py-3 px-4">Village</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD8]">
                  {loadingMembers ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[#863221]">
                        Loading members for {selectedType.typeName}…
                      </td>
                    </tr>
                  ) : filteredTypeMembers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[#863221]">
                        {typeMembers.length === 0
                          ? `No members currently enrolled under ${selectedType.typeName}.`
                          : 'No members match the search query.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedTypeMembers.map((m) => (
                      <tr key={m.id || m.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#863221]">{m.slNo}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#180200]">
                          #{m.memberId}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#180200]">{m.name}</td>
                        <td className="py-3 px-4 font-mono text-[#863221]">{m.mobile}</td>
                        <td className="py-3 px-4 text-[#180200]">{m.district}</td>
                        <td className="py-3 px-4 text-[#863221]">{m.taluk}</td>
                        <td className="py-3 px-4 text-[#863221]">{m.village}</td>
                        <td className="py-3 px-4 text-[#180200]">{m.gender}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{m.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Member Pagination */}
            {filteredTypeMembers.length > 0 && (
              <div className="p-4 bg-[#FAF7F2] border-t border-[#E8DFD8] flex items-center justify-between text-xs text-[#863221]">
                <span>
                  Showing {(memberPage - 1) * memberPageSize + 1} to{' '}
                  {Math.min(memberPage * memberPageSize, filteredTypeMembers.length)} of{' '}
                  {filteredTypeMembers.length} members
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={memberPage <= 1}
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-[#180200]">
                    Page {memberPage} of {totalMemberPages}
                  </span>
                  <button
                    type="button"
                    disabled={memberPage >= totalMemberPages}
                    onClick={() => setMemberPage((p) => Math.min(totalMemberPages, p + 1))}
                    className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW B: OVERALL MEMBERSHIP TYPES SUMMARY */
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search membership type or code..."
                className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
              />
            </div>

            {/* Membership Type Master Dropdown */}
            <select
              value={typeIdFilter}
              onChange={(e) => setTypeIdFilter(e.target.value)}
              className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Membership Types</option>
              {membershipTypes.map((mt) => (
                <option key={mt.id} value={mt.id}>
                  {mt.name}
                </option>
              ))}
            </select>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Districts</option>
              {locations.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Active Only Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] cursor-pointer">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="accent-[#510601]"
              />
              <span>Active Members Only</span>
            </label>

            {/* Reset Action */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-200/80 text-[#863221] text-xs font-semibold rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dataRows.slice(0, 3).map((mt) => (
              <div
                key={mt.typeName}
                onClick={() => setSelectedType(mt)}
                className="bg-white p-5 rounded-2xl border border-[#E8DFD8] hover:border-[#510601] shadow-xs flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#863221] uppercase tracking-wider block">
                      {mt.typeName}
                    </span>
                    <span className="text-xs text-[#510601] font-semibold flex items-center gap-1 group-hover:underline">
                      <Eye className="w-3.5 h-3.5" />
                      View Members
                    </span>
                  </div>
                  <strong className="text-3xl font-bold text-[#510601] mt-2 block">
                    {mt.memberCount}
                  </strong>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8DFD8] flex items-center justify-between text-xs text-[#863221]">
                  <span>Active: <strong className="text-[#180200]">{mt.activeCount || mt.memberCount}</strong></span>
                  <span className="font-semibold text-[#510601]">
                    {totalMembers > 0 ? ((mt.memberCount / totalMembers) * 100).toFixed(1) : 0}% of Total
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Types Table with Click-to-View action */}
          <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
                  <tr>
                    <th className="py-3 px-4">Membership Type</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4 text-right">Fee / Price</th>
                    <th className="py-3 px-4 text-right">Total Members</th>
                    <th className="py-3 px-4 text-right">Active</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD8]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#863221]">
                        Loading membership type report…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#863221]">
                        No records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => {
                      return (
                        <tr
                          key={r.typeName}
                          onClick={() => setSelectedType(r)}
                          className="hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 font-bold text-[#180200] group-hover:text-[#510601]">
                            {r.typeName}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#863221]">{r.typeCode || '—'}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-[#180200]">
                            {r.currentPrice ? `₹${r.currentPrice.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#510601]">{r.memberCount}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">{r.activeCount || r.memberCount}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedType(r);
                              }}
                              className="px-3 py-1 bg-amber-50 hover:bg-[#510601] text-amber-900 hover:text-white border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              View Members ({r.memberCount})
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
