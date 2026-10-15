import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { fetchMagazineReturnsReport, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadLocations } from '../../utils/serverData';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';

const RETURN_COLUMNS = [
  { key: 'slNo', label: 'Sl No' },
  { key: 'memberId', label: 'Membership No' },
  { key: 'name', label: 'Member Name' },
  { key: 'issueMonth', label: 'Issue' },
  { key: 'returnDate', label: 'Attempt / Return Date' },
  { key: 'returnReason', label: 'Return Reason' },
  { key: 'district', label: 'District' },
  { key: 'taluk', label: 'Taluk' },
  { key: 'consecutiveMissed', label: 'Missed Attempts' },
  { key: 'deliveryStatus', label: 'Delivery Status' },
];

export default function MagazineReturnsReport({ hideNavHeader = false }) {
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });
  const [loading, setLoading] = useState(true);

  // Filters
  const [monthFilter, setMonthFilter] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('ALL'); // 'ALL' | 'HOLD' | 'PENDING' | 'RESOLVED'
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
      fetchMagazineReturnsReport({
        issue_month_year: monthFilter || undefined,
        district_id: districtFilter !== 'ALL' ? Number(districtFilter) : undefined,
        taluk_id: talukFilter !== 'ALL' ? Number(talukFilter) : undefined,
      }),
      loadLocations(),
    ]).then(([repRes, locRes]) => {
      if (cancelled) return;
      if (repRes.status === 'fulfilled') {
        const raw = repRes.value || [];

        // Count returns per member to calculate consecutive missed attempts
        const returnCountByMember = {};
        raw.forEach((r) => {
          const mKey = r.member_code || r.membership_number || r.member_id || r.id || 'unknown';
          returnCountByMember[mKey] = (returnCountByMember[mKey] || 0) + 1;
        });

        setRecords(
          raw.map((r, idx) => {
            const mKey = r.member_code || r.membership_number || r.member_id || r.id || 'unknown';
            const missedCount = returnCountByMember[mKey] || 1;
            const isHold = missedCount >= 3;
            const followStatus = String(r.follow_up_status || r.status || 'Pending KYC');
            const isResolved = followStatus.toLowerCase().includes('resolved') || followStatus.toLowerCase().includes('dispatched');

            let deliveryStatus = 'Active / Under Review';
            let deliveryStatusCode = 'PENDING';
            if (isResolved) {
              deliveryStatus = 'Re-dispatched';
              deliveryStatusCode = 'RESOLVED';
            } else if (isHold) {
              deliveryStatus = 'Delivery Hold (3+ Missed)';
              deliveryStatusCode = 'HOLD';
            } else {
              deliveryStatus = `Not Received (${missedCount} Missed)`;
              deliveryStatusCode = 'PENDING';
            }

            return {
              ...r,
              slNo: idx + 1,
              memberId: r.member_code || r.membership_number || r.member_id || r.id || '—',
              name: r.member_name || r.name || r.full_name_en || '—',
              issueMonth: r.issue_month_year || r.issue_month || '—',
              returnDate: r.return_date || r.date || '',
              returnReason: r.reason || r.return_reason || r.remarks || 'Undelivered / Address Incomplete',
              district: r.district_name || r.district || '—',
              districtId: r.district_id || '',
              taluk: r.taluk_name || r.taluk || '—',
              talukId: r.taluk_id || '',
              consecutiveMissed: missedCount,
              deliveryStatus,
              deliveryStatusCode,
              isHold,
            };
          })
        );
      }
      if (locRes.status === 'fulfilled') setLocations(locRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [monthFilter, districtFilter, talukFilter]);

  // Dependent Taluks
  const availableTaluks = useMemo(() => {
    if (districtFilter === 'ALL') return locations.taluks;
    return locations.taluks.filter((t) => String(t.districtId) === String(districtFilter));
  }, [locations.taluks, districtFilter]);

  // Search and Status filtering working together
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (deliveryStatusFilter !== 'ALL' && r.deliveryStatusCode !== deliveryStatusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(r.name).toLowerCase().includes(q);
        const matchesId = String(r.memberId).toLowerCase().includes(q);
        const matchesReason = String(r.returnReason).toLowerCase().includes(q);
        const matchesDistrict = String(r.district).toLowerCase().includes(q);
        const matchesTaluk = String(r.taluk).toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesReason && !matchesDistrict && !matchesTaluk) return false;
      }
      return true;
    });
  }, [records, deliveryStatusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset Filters
  const handleResetFilters = () => {
    setMonthFilter('');
    setDeliveryStatusFilter('ALL');
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
    notify('Filters reset.');
  };

  // Excel Export (.xlsx)
  const handleExportExcel = () => {
    try {
      const success = exportRowsToExcel(
        RETURN_COLUMNS,
        filteredRecords,
        `magazine_returns_${new Date().toISOString().slice(0, 10)}.xlsx`
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
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight flex items-center gap-2">
            <span>Magazine Returned Report</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
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
            placeholder="Search member, ID, or return reason..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
          />
        </div>

        {/* Issue Month */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
          <span className="text-[11px] font-semibold text-[#863221]">Issue Month:</span>
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

        {/* Reset Action */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-200/80 text-[#863221] text-xs font-semibold rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                {RETURN_COLUMNS.map((col) => (
                  <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-[#863221]">
                    Loading magazine returns…
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-[#863221]">
                    No magazine return records match the current filter.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => (
                  <tr
                    key={r.id || r.slNo}
                    className={`transition-colors ${r.isHold ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-[#FAF7F2]/60'
                      }`}
                  >
                    <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#180200]">
                      #{r.memberId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#180200]">{r.name}</td>
                    <td className="py-3 px-4 font-mono text-[#863221]">{r.issueMonth}</td>
                    <td className="py-3 px-4 text-[#180200] whitespace-nowrap">
                      {r.returnDate ? formatDate(r.returnDate) : '—'}
                    </td>
                    <td className="py-3 px-4 text-[#863221] max-w-xs truncate" title={r.returnReason}>
                      {r.returnReason}
                    </td>
                    <td className="py-3 px-4 text-[#180200]">{r.district}</td>
                    <td className="py-3 px-4 text-[#863221]">{r.taluk}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${r.consecutiveMissed >= 3
                            ? 'bg-red-100 text-red-900 font-extrabold'
                            : 'bg-stone-100 text-stone-800'
                          }`}
                      >
                        {r.consecutiveMissed}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.isHold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Delivery Hold (3+)</span>
                        </span>
                      ) : r.deliveryStatusCode === 'RESOLVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Re-dispatched</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
                        </span>
                      )}
                    </td>
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
    </div>
  );
}
