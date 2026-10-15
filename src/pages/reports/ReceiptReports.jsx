import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Printer,
  Users,
  RotateCcw,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { fetchReceiptsReport, exportRowsToCsv, exportRowsToExcel } from '../../utils/reportApi';
import { loadParticulars, loadPaymentModeConfigs } from '../../utils/serverData';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';
import clsx from 'clsx';

const RECEIPT_COLUMNS = [
  { key: 'slNo', label: 'Sl No' },
  { key: 'receiptNumber', label: 'Receipt No' },
  { key: 'receiptDate', label: 'Receipt Date' },
  { key: 'memberName', label: 'Member / Payee' },
  { key: 'membershipNumber', label: 'Membership No' },
  { key: 'receiptType', label: 'Particulars' },
  { key: 'amount', label: 'Amount (₹)' },
  { key: 'paymentMode', label: 'Payment Mode' },
  { key: 'transactionRef', label: 'Transaction / Cheque Ref' },
  { key: 'status', label: 'Status' },
];

export default function ReceiptReports({ hideNavHeader = false, initialTab = 'general' }) {
  const [receipts, setReceipts] = useState([]);
  const [particularsList, setParticularsList] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'general' (General Receipt Report) | 'by-member' (Receipt-wise Members Report)
  const [activeTab, setActiveTab] = useState(initialTab);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for General Report
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Pagination for Member Grouped Report
  const [memberPage, setMemberPage] = useState(1);
  const memberPageSize = 10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchReceiptsReport({
        payment_status: statusFilter !== 'ALL' ? statusFilter : undefined,
        payment_mode: modeFilter !== 'ALL' ? modeFilter : undefined,
        receipt_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
      loadParticulars(),
      loadPaymentModeConfigs(),
    ]).then(([repRes, partRes, modeRes]) => {
      if (cancelled) return;
      if (repRes.status === 'fulfilled') {
        const raw = repRes.value || [];
        setReceipts(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            receiptNumber: r.receipt_number || r.receiptNumber || r.id,
            receiptDate: r.receipt_date || r.date || '',
            memberName: r.member_name || r.payee_name || r.payer_name || r.name || 'Anonymous',
            memberId: r.member_id || r.memberId || null,
            membershipNumber: r.membership_number || r.member_code || r.membershipNo || '—',
            receiptType: r.receipt_type || r.particulars || 'General Receipt',
            amount: Number(r.amount || r.net_amount || r.gross_amount || 0),
            paymentMode: r.payment_mode || r.paymentMode || 'OTHER',
            transactionRef: r.transaction_reference || r.cheque_number || r.transactionId || '—',
            status: r.payment_status || r.status || 'Completed',
          }))
        );
      }
      if (partRes.status === 'fulfilled') setParticularsList(partRes.value || []);
      if (modeRes.status === 'fulfilled') setPaymentModes(modeRes.value || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, modeFilter, typeFilter, fromDate, toDate]);

  // Client-side Search filter
  const filteredReceipts = useMemo(() => {
    if (!searchQuery.trim()) return receipts;
    const q = searchQuery.toLowerCase().trim();
    return receipts.filter((r) => {
      return (
        String(r.receiptNumber).toLowerCase().includes(q) ||
        String(r.memberName).toLowerCase().includes(q) ||
        String(r.membershipNumber).toLowerCase().includes(q) ||
        String(r.transactionRef).toLowerCase().includes(q) ||
        String(r.receiptType).toLowerCase().includes(q)
      );
    });
  }, [receipts, searchQuery]);

  // Accurate full dataset totals
  const totalAmount = useMemo(() => {
    return filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredReceipts]);

  // Receipt-wise Members Grouping
  const memberGroupedData = useMemo(() => {
    const groups = new Map();
    filteredReceipts.forEach((r) => {
      const key = r.memberId ? `id_${r.memberId}` : `name_${r.memberName}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          memberName: r.memberName,
          membershipNumber: r.membershipNumber,
          memberId: r.memberId,
          totalAmount: 0,
          receiptCount: 0,
          receipts: [],
        });
      }
      const g = groups.get(key);
      g.totalAmount += r.amount;
      g.receiptCount += 1;
      g.receipts.push(r);
    });
    return Array.from(groups.values());
  }, [filteredReceipts]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [filteredReceipts, currentPage, pageSize]);

  const totalMemberPages = Math.max(1, Math.ceil(memberGroupedData.length / memberPageSize));
  const paginatedMemberGroups = useMemo(() => {
    const start = (memberPage - 1) * memberPageSize;
    return memberGroupedData.slice(start, start + memberPageSize);
  }, [memberGroupedData, memberPage, memberPageSize]);

  // Reset Filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setModeFilter('ALL');
    setTypeFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setCurrentPage(1);
    setMemberPage(1);
    notify('Filters reset.');
  };

  // Excel Export (.xlsx)
  const handleExportExcel = () => {
    try {
      const success = exportRowsToExcel(
        RECEIPT_COLUMNS,
        filteredReceipts,
        `receipt_reports_${new Date().toISOString().slice(0, 10)}.xlsx`
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
            Receipt Reports
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

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Total Collections</span>
          <strong className="text-2xl sm:text-3xl font-bold text-[#510601] mt-1 block font-mono">
            ₹{loading ? '—' : totalAmount.toLocaleString('en-IN')}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Total Receipts Issued</span>
          <strong className="text-2xl font-bold text-[#180200] mt-1 block">
            {loading ? '—' : filteredReceipts.length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Contributing Members</span>
          <strong className="text-2xl font-bold text-emerald-800 mt-1 block">
            {loading ? '—' : memberGroupedData.length}
          </strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs">
          <span className="text-xs text-[#863221] block font-semibold">Average Receipt Value</span>
          <strong className="text-2xl font-bold text-[#180200] mt-1 block font-mono">
            ₹{filteredReceipts.length > 0 ? Math.round(totalAmount / filteredReceipts.length).toLocaleString('en-IN') : 0}
          </strong>
        </div>
      </div>


      {/* Filter Bar (Shared Across Both Views) */}
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
              setMemberPage(1);
            }}
            placeholder="Search receipt no, member, or ref..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
          />
        </div>

        {/* Dynamic Particulars Master Filter */}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1);
            setMemberPage(1);
          }}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Particulars</option>
          {particularsList.map((p) => (
            <option key={p.id || p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Dynamic Payment Mode Filter */}
        <select
          value={modeFilter}
          onChange={(e) => {
            setModeFilter(e.target.value);
            setCurrentPage(1);
            setMemberPage(1);
          }}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Payment Modes</option>
          {paymentModes.map((pm) => (
            <option key={pm.id || pm.name} value={pm.name || pm.code}>
              {pm.name || pm.code}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
            setMemberPage(1);
          }}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>

        {/* Date Range: From & To */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
          <span className="text-[11px] font-semibold text-[#863221]">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setCurrentPage(1);
              setMemberPage(1);
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
              setMemberPage(1);
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

      {/* VIEW 1: GENERAL RECEIPT REPORT (TABLE) */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold">
                <tr>
                  {RECEIPT_COLUMNS.map((col) => (
                    <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD8]">
                {loading ? (
                  <tr>
                    <td colSpan={RECEIPT_COLUMNS.length} className="text-center py-12 text-[#863221]">
                      Loading receipt records…
                    </td>
                  </tr>
                ) : paginatedReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={RECEIPT_COLUMNS.length} className="text-center py-12 text-[#863221]">
                      No receipt records match the selected filter parameters.
                    </td>
                  </tr>
                ) : (
                  paginatedReceipts.map((r) => (
                    <tr key={r.receiptNumber || r.slNo} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#510601]">{r.receiptNumber}</td>
                      <td className="py-3 px-4 text-[#180200] whitespace-nowrap">{formatDate(r.receiptDate) || '—'}</td>
                      <td className="py-3 px-4 font-semibold text-[#180200]">{r.memberName}</td>
                      <td className="py-3 px-4 font-mono text-[#863221]">{r.membershipNumber}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF7F2] border border-[#E8DFD8] text-[#863221]">
                          {r.receiptType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#510601]">
                        ₹{r.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-[#180200]">{r.paymentMode}</td>
                      <td className="py-3 px-4 font-mono text-xs text-[#863221]">{r.transactionRef}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* General Report Pagination */}
          <div className="p-4 bg-[#FAF7F2] border-t border-[#E8DFD8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#863221]">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredReceipts.length)} of {filteredReceipts.length} receipts
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-semibold text-[#180200]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RECEIPT-WISE MEMBERS REPORT */}
      {activeTab === 'by-member' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E8DFD8] text-[#863221]">
              Loading member receipts…
            </div>
          ) : memberGroupedData.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E8DFD8] text-[#863221]">
              No members found with matching receipts under the current filter.
            </div>
          ) : (
            paginatedMemberGroups.map((mg) => (
              <div key={mg.key} className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
                <div className="bg-[#FAF7F2] p-4 border-b border-[#E8DFD8] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#510601]/10 text-[#510601] flex items-center justify-center font-bold">
                      {mg.memberName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#180200] text-sm sm:text-base">{mg.memberName}</h3>
                      <span className="text-xs text-[#863221]">Membership No: {mg.membershipNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-[#863221] block">Receipts Count</span>
                      <strong className="text-sm font-bold text-[#180200]">{mg.receiptCount}</strong>
                    </div>
                    <div>
                      <span className="text-[#863221] block">Total Contributed</span>
                      <strong className="text-sm font-bold text-[#510601] font-mono">
                        ₹{mg.totalAmount.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Receipt No</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Particulars</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4">Payment Mode</th>
                        <th className="py-2.5 px-4">Transaction / Ref</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {mg.receipts.map((r) => (
                        <tr key={r.receiptNumber} className="hover:bg-stone-50/60">
                          <td className="py-2.5 px-4 font-mono font-bold text-[#510601]">{r.receiptNumber}</td>
                          <td className="py-2.5 px-4">{formatDate(r.receiptDate)}</td>
                          <td className="py-2.5 px-4 font-medium">{r.receiptType}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#180200]">
                            ₹{r.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4">{r.paymentMode}</td>
                          <td className="py-2.5 px-4 font-mono text-stone-500">{r.transactionRef}</td>
                          <td className="py-2.5 px-4 text-emerald-700 font-semibold">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {/* Member Groups Pagination */}
          {memberGroupedData.length > 0 && (
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8DFD8] flex items-center justify-between text-xs text-[#863221]">
              <span>
                Showing {(memberPage - 1) * memberPageSize + 1} to{' '}
                {Math.min(memberPage * memberPageSize, memberGroupedData.length)} of {memberGroupedData.length} members
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={memberPage <= 1}
                  onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-semibold text-[#180200]">
                  Page {memberPage} of {totalMemberPages}
                </span>
                <button
                  type="button"
                  disabled={memberPage >= totalMemberPages}
                  onClick={() => setMemberPage((p) => Math.min(totalMemberPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#E8DFD8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
