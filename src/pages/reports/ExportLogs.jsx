import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { fetchExportLogs } from '../../utils/reportApi';
import { formatDate } from '../../utils/dateUtils';
import { notify } from '../../utils/notify';

export default function ExportLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportKeyFilter, setReportKeyFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchExportLogs({
      report_key: reportKeyFilter !== 'ALL' ? reportKeyFilter : undefined,
      page,
      limit: pageSize,
    })
      .then((data) => {
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : [];
        setLogs(
          raw.map((l, idx) => ({
            ...l,
            slNo: (page - 1) * pageSize + idx + 1,
            reportKey: l.report_key || l.report_name || l.type || 'Generic Export',
            format: (l.export_format || l.format || 'CSV').toUpperCase(),
            userName: l.user_name || l.user_id || l.created_by || 'System User',
            timestamp: l.created_at || l.timestamp || l.date || '',
            status: l.status || 'Success',
            recordCount: l.record_count || l.total_records || '—',
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          notify(err.response?.data?.detail || 'Failed to load export audit logs from server.', 'error');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reportKeyFilter, page]);

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Export Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
            Read-only chronological trail of data export events, format generation, and requesting operators.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#863221]">Filter by Report Type:</span>
          <select
            value={reportKeyFilter}
            onChange={(e) => {
              setReportKeyFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Report Types</option>
            <option value="members">Approved Members</option>
            <option value="unapproved_members">Unapproved Members</option>
            <option value="geography">Geography Breakdown</option>
            <option value="gender">Gender Demographics</option>
            <option value="receipts">Receipts</option>
            <option value="labels">Labels</option>
            <option value="magazine_returns">Magazine Returns</option>
          </select>
        </div>
        <span className="text-xs text-[#863221]">Page {page}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
              <tr>
                <th className="py-3 px-4">Sl No</th>
                <th className="py-3 px-4">Report Module</th>
                <th className="py-3 px-4">Export Format</th>
                <th className="py-3 px-4">Operator / User</th>
                <th className="py-3 px-4">Records Exported</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD8]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[#863221]">
                    Reading export logs from server…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[#863221]">
                    No export events recorded on the server for the selected filter.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#863221]">{l.slNo}</td>
                    <td className="py-3 px-4 font-bold text-[#180200]">{l.reportKey}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FAF7F2] border border-[#E8DFD8] text-[#510601]">
                        {l.format}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#180200] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#863221]/60" />
                      <span>{l.userName}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#863221]">{l.recordCount}</td>
                    <td className="py-3 px-4 text-[#863221] whitespace-nowrap">
                      {formatDate(l.timestamp) || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{l.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[#E8DFD8] flex items-center justify-between text-xs text-[#863221]">
          <span>Showing page {page}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg border border-[#E8DFD8] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-[#180200]">Page {page}</span>
            <button
              type="button"
              disabled={logs.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
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
