import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { fetchMembersReport, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';
import Modal from '../../components/Modal';

const ALL_COLUMNS = [
  { key: 'memberId', label: 'Membership No', defaultSelected: true },
  { key: 'name', label: 'Member Name', defaultSelected: true },
  { key: 'mobile', label: 'Mobile', defaultSelected: true },
  { key: 'membershipType', label: 'Membership Type', defaultSelected: true },
  { key: 'state', label: 'State', defaultSelected: false },
  { key: 'district', label: 'District', defaultSelected: true },
  { key: 'taluk', label: 'Taluk', defaultSelected: true },
  { key: 'village', label: 'Village', defaultSelected: false },
  { key: 'gender', label: 'Gender', defaultSelected: true },
  { key: 'bloodGroup', label: 'Blood Group', defaultSelected: false },
  { key: 'status', label: 'Status', defaultSelected: true },
];

export default function ApprovedMembersReport({
  hideNavHeader = false,
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
  hideSearchInput = false,
  districtFilter: propDistrictFilter = 'ALL',
  talukFilter: propTalukFilter = 'ALL',
  genderFilter: propGenderFilter = 'ALL',
  locations: propLocations = null,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalLocations, setInternalLocations] = useState({ states: [], districts: [], taluks: [] });

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = propOnSearchChange || setInternalSearchQuery;
  const districtFilter = propDistrictFilter;
  const talukFilter = propTalukFilter;
  const genderFilter = propGenderFilter;
  const locations = propLocations || internalLocations;

  useEffect(() => {
    if (!propLocations) {
      loadLocations().then(setInternalLocations).catch(() => {});
    }
  }, [propLocations]);

  // Columns displayed in Report
  const [selectedColumns] = useState(() =>
    ALL_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key)
  );

  // Print Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Load Members Report
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchMembersReport({ approval_status: 'APPROVED' })
      .then((raw) => {
        if (cancelled) return;
        const list = raw || [];
        setMembers(
          list.map((m, idx) => ({
            ...m,
            slNo: idx + 1,
            memberId: m.member_code || m.membership_number || m.membershipNumber || m.id,
            name: m.full_name_en || m.name || m.fullName || [m.first_name_en, m.last_name_en].filter(Boolean).join(' ') || '—',
            mobile: m.mobile || m.mobileNumber || m.phone || '',
            membershipType: m.membership_type || m.membershipType || m.category || '',
            state: m.state_name || m.state || '',
            stateId: m.state_id || m.stateId || '',
            district: m.district_name || m.district || '',
            districtId: m.district_id || m.districtId || '',
            taluk: m.taluk_name || m.taluk || '',
            talukId: m.taluk_id || m.talukId || '',
            village: m.village || m.place || m.area || '',
            gender: m.gender || '',
            bloodGroup: m.blood_group || m.bloodGroup || '',
            status: m.member_status || m.status || 'Active',
          }))
        );
      })
      .catch((err) => {
        console.error('Failed to load approved members:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Multi-filter matching: District, Taluk, Gender and Search query
  const filteredRecords = useMemo(() => {
    return members.filter((m) => {
      // 1. District filter
      if (districtFilter && districtFilter !== 'ALL') {
        const dId = String(m.districtId || '');
        const dName = String(m.district || '').toLowerCase();
        const selectedDist = (locations.districts || []).find((d) => String(d.id) === String(districtFilter));
        const targetName = selectedDist ? selectedDist.name.toLowerCase() : '';
        const matchesDistrict = dId === String(districtFilter) || (targetName && dName === targetName);
        if (!matchesDistrict) return false;
      }

      // 2. Taluk filter
      if (talukFilter && talukFilter !== 'ALL') {
        const tId = String(m.talukId || '');
        const tName = String(m.taluk || '').toLowerCase();
        const selectedTaluk = (locations.taluks || []).find((t) => String(t.id) === String(talukFilter));
        const targetName = selectedTaluk ? selectedTaluk.name.toLowerCase() : '';
        const matchesTaluk = tId === String(talukFilter) || (targetName && tName === targetName);
        if (!matchesTaluk) return false;
      }

      // 3. Gender filter
      if (genderFilter && genderFilter !== 'ALL') {
        const mGender = String(m.gender || '').trim().toLowerCase();
        const filterG = String(genderFilter).trim().toLowerCase();
        if (filterG === 'male') {
          if (mGender !== 'male') return false;
        } else if (filterG === 'female') {
          if (mGender !== 'female') return false;
        } else {
          // Other
          if (mGender === 'male' || mGender === 'female' || !mGender) return false;
        }
      }

      // 4. Search query
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(m.name || '').toLowerCase().includes(q);
        const matchesNo = String(m.memberId || '').toLowerCase().includes(q);
        const matchesMobile = String(m.mobile || '').includes(q);
        const matchesLocation = `${m.district} ${m.taluk} ${m.village} ${m.state}`.toLowerCase().includes(q);
        const matchesType = String(m.membershipType || '').toLowerCase().includes(q);
        const matchesGender = String(m.gender || '').toLowerCase().includes(q);
        if (!matchesName && !matchesNo && !matchesMobile && !matchesLocation && !matchesType && !matchesGender) {
          return false;
        }
      }

      return true;
    });
  }, [members, searchQuery, districtFilter, talukFilter, genderFilter, locations]);

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
      const cols = ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key)).map((c) => ({
        key: c.key,
        label: c.label,
      }));
      const success = exportRowsToExcel(
        cols,
        filteredRecords,
        `approved_members_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      if (success) notify('Exported to Excel successfully (.xlsx).');
      else notify('No records to export.', 'error');
    } catch {
      notify('Export failed.', 'error');
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const success = exportRowsToCsv(
        ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key)).map((c) => ({
          key: c.key,
          label: c.label,
        })),
        filteredRecords,
        `approved_members_${new Date().toISOString().slice(0, 10)}.csv`
      );
      if (success) notify('CSV exported successfully.');
    } catch {
      notify('Export failed.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Heading & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#180200] tracking-tight flex items-center gap-2">
            <span>Approved Members</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'}
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            title="Export full filtered report to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>

          {/* Print Preview Button */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Search Bar (standalone mode only) */}
      {!hideSearchInput && (
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex items-center">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#863221]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search members..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#180200] placeholder-[#863221]/40 focus:outline-none focus:ring-1 focus:ring-[#510601] shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                {ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key)).map((col) => (
                  <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td
                    colSpan={selectedColumns.length || 6}
                    className="text-center py-12 text-[#863221]"
                  >
                    Loading approved members…
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedColumns.length || 6}
                    className="text-center py-12 text-[#863221]"
                  >
                    No approved members found matching the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    {selectedColumns.includes('memberId') && (
                      <td className="py-3 px-4 font-mono font-bold text-[#180200]">
                        #{m.memberId}
                      </td>
                    )}
                    {selectedColumns.includes('name') && (
                      <td className="py-3 px-4 font-semibold text-[#180200]">{m.name}</td>
                    )}
                    {selectedColumns.includes('mobile') && (
                      <td className="py-3 px-4 font-mono text-[#863221]">{m.mobile || '—'}</td>
                    )}
                    {selectedColumns.includes('membershipType') && (
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold">
                          {m.membershipType || 'Standard'}
                        </span>
                      </td>
                    )}
                    {selectedColumns.includes('state') && (
                      <td className="py-3 px-4 text-[#863221]">{m.state || '—'}</td>
                    )}
                    {selectedColumns.includes('district') && (
                      <td className="py-3 px-4 text-[#180200]">{m.district || '—'}</td>
                    )}
                    {selectedColumns.includes('taluk') && (
                      <td className="py-3 px-4 text-[#863221]">{m.taluk || '—'}</td>
                    )}
                    {selectedColumns.includes('village') && (
                      <td className="py-3 px-4 text-[#863221]">{m.village || '—'}</td>
                    )}
                    {selectedColumns.includes('gender') && (
                      <td className="py-3 px-4 text-[#180200]">{m.gender || '—'}</td>
                    )}
                    {selectedColumns.includes('bloodGroup') && (
                      <td className="py-3 px-4 font-mono text-[#863221]">{m.bloodGroup || '—'}</td>
                    )}
                    {selectedColumns.includes('status') && (
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{m.status}</span>
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#E8DFD8] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#863221]">
          <span>
            Showing{' '}
            <strong>
              {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(currentPage * pageSize, filteredRecords.length)}
            </strong>{' '}
            of <strong>{filteredRecords.length}</strong> records
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-[#180200]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 2: Print Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      >
        <div
          className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-[#E8DFD8] overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#E8DFD8] bg-[#FAF7F2] px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-[#180200]">All Approved Members Report</h2>
              <span className="text-xs text-[#863221]">
                Total Records: {filteredRecords.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                title="Export directly to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export to Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 text-stone-400 hover:text-[#510601] rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body / Printable Area */}
          <div className="p-6 overflow-y-auto space-y-4 bg-stone-50/40">
            <div
              ref={printRef}
              className="bg-white border border-stone-200 rounded-xl p-6 text-black print:p-0 print:border-none shadow-xs font-sans"
            >
              <div className="text-center pb-4 mb-4 border-b border-black">
                <h1 className="text-lg font-bold uppercase tracking-wide">
                  Shree Akhila Havyaka Mahasabha (R.)
                </h1>
                <h2 className="text-sm font-semibold mt-1">
                  Approved Members Report
                </h2>
                <p className="text-[11px] mt-0.5">
                  Generated: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </p>
              </div>

              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-xs border border-collapse border-black">
                  <thead>
                    <tr className="bg-stone-100 border-b border-black">
                      {ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key)).map((col) => (
                        <th key={col.key} className="py-2 px-2.5 font-bold border-r border-black last:border-r-0">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 500).map((m, i) => (
                      <tr key={m.id || i} className="border-b border-stone-300">
                        {selectedColumns.includes('memberId') && <td className="py-1.5 px-2.5 border-r border-stone-300 font-mono">#{m.memberId}</td>}
                        {selectedColumns.includes('name') && <td className="py-1.5 px-2.5 border-r border-stone-300 font-medium">{m.name}</td>}
                        {selectedColumns.includes('mobile') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.mobile}</td>}
                        {selectedColumns.includes('membershipType') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.membershipType}</td>}
                        {selectedColumns.includes('state') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.state}</td>}
                        {selectedColumns.includes('district') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.district}</td>}
                        {selectedColumns.includes('taluk') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.taluk}</td>}
                        {selectedColumns.includes('village') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.village}</td>}
                        {selectedColumns.includes('gender') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.gender}</td>}
                        {selectedColumns.includes('bloodGroup') && <td className="py-1.5 px-2.5 border-r border-stone-300">{m.bloodGroup}</td>}
                        {selectedColumns.includes('status') && <td className="py-1.5 px-2.5">{m.status}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRecords.length > 500 && (
                  <p className="text-[11px] text-stone-500 mt-2 text-center">
                    * Showing first 500 records in preview. Use Export CSV for full batch of {filteredRecords.length} records.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
