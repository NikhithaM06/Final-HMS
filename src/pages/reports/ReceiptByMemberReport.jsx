import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  CreditCard,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { fetchReceiptsByMemberReport, exportRowsToCsv } from '../../utils/reportApi';
import { fetchMembers } from '../../utils/apiAdapters';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateUtils';

const RECEIPT_COLUMNS = [
  { key: 'slNo', label: 'Sl No' },
  { key: 'receiptNumber', label: 'Receipt No' },
  { key: 'receiptDate', label: 'Receipt Date' },
  { key: 'receiptType', label: 'Particulars' },
  { key: 'amount', label: 'Amount (₹)' },
  { key: 'paymentMode', label: 'Payment Mode' },
  { key: 'transactionRef', label: 'Reference / Cheque' },
  { key: 'status', label: 'Status' },
];

export default function ReceiptByMemberReport({ hideNavHeader = false }) {
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberReceipts, setMemberReceipts] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // Filters
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Initial Members Load for Lookup
  useEffect(() => {
    let cancelled = false;
    setLoadingMembers(true);
    fetchMembers({ limit: 5000 })
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
        if (data.length > 0) {
          setSelectedMember(data[0]); // default to first member
        }
        setLoadingMembers(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch receipts for the selected member
  useEffect(() => {
    if (!selectedMember) {
      setMemberReceipts([]);
      return;
    }

    let cancelled = false;
    setLoadingReceipts(true);

    fetchReceiptsByMemberReport({
      member_id: selectedMember.id,
      receipt_type: typeFilter !== 'ALL' ? typeFilter : undefined,
      payment_mode: modeFilter !== 'ALL' ? modeFilter : undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : [];
        setMemberReceipts(
          raw.map((r, idx) => ({
            ...r,
            slNo: idx + 1,
            receiptNumber: r.receipt_number || r.receiptNumber || r.id,
            receiptDate: r.receipt_date || r.date || '',
            receiptType: r.receipt_type || r.particulars || 'MEMBERSHIP',
            amount: Number(r.amount || r.net_amount || r.gross_amount || 0),
            paymentMode: r.payment_mode || r.paymentMode || 'OTHER',
            transactionRef: r.transaction_reference || r.cheque_number || r.transactionId || '—',
            status: r.payment_status || r.status || 'Completed',
          }))
        );
        setLoadingReceipts(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingReceipts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMember, typeFilter, modeFilter, fromDate, toDate]);

  // Filtered members in lookup dropdown
  const filteredMemberList = useMemo(() => {
    if (!memberSearchQuery.trim()) return members.slice(0, 100);
    const q = memberSearchQuery.toLowerCase().trim();
    return members
      .filter((m) => {
        return (
          String(m.name || m.fullName).toLowerCase().includes(q) ||
          String(m.membershipNumber || m.id).toLowerCase().includes(q) ||
          String(m.mobile).includes(q)
        );
      })
      .slice(0, 100);
  }, [members, memberSearchQuery]);

  const totalPaid = useMemo(() => {
    return memberReceipts.reduce((sum, r) => sum + r.amount, 0);
  }, [memberReceipts]);

  // Export CSV
  const handleExportCsv = () => {
    if (!selectedMember) return;
    try {
      const success = exportRowsToCsv(
        RECEIPT_COLUMNS,
        memberReceipts,
        `receipts_member_${selectedMember.membershipNumber || selectedMember.id}_${new Date().toISOString().slice(0, 10)}.csv`
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Receipt Reports by Member
          </h1>
          <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
            Individual member financial statement and transaction history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedMember || memberReceipts.length === 0}
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
          <button
            type="button"
            disabled={!selectedMember || memberReceipts.length === 0}
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Member Selector Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="text-xs font-bold text-[#863221] uppercase tracking-wider block mb-1.5">
            Select Member to View Receipts:
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[#863221]/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
              placeholder="Search member name, ID, or mobile..."
              className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none focus:ring-1 focus:ring-[#510601]"
            />
          </div>
          {memberSearchQuery.trim() && (
            <div className="mt-1 bg-white border border-[#E8DFD8] rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-[#E8DFD8] z-20 relative">
              {filteredMemberList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(m);
                    setMemberSearchQuery('');
                  }}
                  className="w-full text-left p-2.5 text-xs hover:bg-[#FAF7F2] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <strong className="text-[#180200] block">{m.fullName || m.name}</strong>
                    <span className="text-[#863221]">ID: {m.membershipNumber} | Mobile: {m.mobile || '—'}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#510601]">{m.category || 'Member'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Member Profile Card */}
        {selectedMember && (
          <div className="flex-1 bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DFD8] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#510601] text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                {(selectedMember.fullName || selectedMember.name || 'M').charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-[#180200] text-sm sm:text-base">
                  {selectedMember.fullName || selectedMember.name}
                </h3>
                <div className="text-xs text-[#863221] mt-0.5 space-x-2">
                  <span>ID: <strong className="text-[#510601]">{selectedMember.membershipNumber}</strong></span>
                  <span>•</span>
                  <span>{selectedMember.mobile || 'No Mobile'}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-[#863221] block">Total Contributed</span>
              <strong className="text-xl font-bold text-[#510601] font-mono">
                ₹{totalPaid.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-xs flex flex-wrap items-center gap-3">
        {/* Particulars Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Particulars</option>
          <option value="MEMBERSHIP">Membership</option>
          <option value="DONATION">Donation</option>
          <option value="MAGAZINE">Magazine Subscription</option>
          <option value="SCHOLARSHIP">Scholarship</option>
          <option value="EVENT">Event Fee</option>
        </select>

        {/* Payment Mode Filter */}
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#180200] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Payment Modes</option>
          <option value="CASH">Cash</option>
          <option value="CHEQUE">Cheque</option>
          <option value="UPI">UPI</option>
          <option value="NETBANKING">Net Banking</option>
          <option value="CARD">Card</option>
        </select>

        {/* Date From & To */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
          <span className="text-[11px] font-semibold text-[#863221]">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-transparent border-none text-xs text-[#180200] focus:outline-none cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-3 py-1.5 rounded-xl border border-[#E8DFD8]">
          <span className="text-[11px] font-semibold text-[#863221]">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-transparent border-none text-xs text-[#180200] focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Receipts Table */}
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
              {loadingReceipts ? (
                <tr>
                  <td colSpan={RECEIPT_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    Loading member receipt history…
                  </td>
                </tr>
              ) : memberReceipts.length === 0 ? (
                <tr>
                  <td colSpan={RECEIPT_COLUMNS.length} className="text-center py-10 text-[#863221]">
                    No receipts recorded for this member with the selected filters.
                  </td>
                </tr>
              ) : (
                memberReceipts.map((r) => (
                  <tr key={r.receiptNumber} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#863221]">{r.slNo}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#510601]">{r.receiptNumber}</td>
                    <td className="py-3 px-4 text-[#180200] whitespace-nowrap">{formatDate(r.receiptDate) || '—'}</td>
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
      </div>
    </div>
  );
}
