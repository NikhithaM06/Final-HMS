import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Calendar,
  Search,
  RotateCcw,
  CheckCircle2,
  Users,
  UserCheck,
  User,
  MapPin,
  Building,
  CheckSquare,
  Square,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  FileText,
  Eye,
  SlidersHorizontal,
  Award
} from 'lucide-react';
import Modal from '../components/Modal';
import PermissionGate from '../components/PermissionGate';
import useAuth from '../hooks/useAuth';
import { notify } from '../utils/notify';
import { fetchMembers, fetchReceipts } from '../utils/apiAdapters';
import { loadLocations, loadMembershipTypes } from '../utils/serverData';
import { calculateMemberMembershipStatus } from '../utils/displayHelpers';

// Helper to format ISO YYYY-MM to human readable (e.g., "October 2026")
const formatMonthYear = (yearMonthStr) => {
  const safe = yearMonthStr || getCurrentYearMonth();
  const [year, month] = safe.split('-');
  const date = new Date(Number(year) || new Date().getFullYear(), (Number(month) || 1) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Current month helper: "YYYY-MM"
const getCurrentYearMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export default function LabelPrint({ hideNavHeader = false } = {}) {
  const { hasPermission } = useAuth();

  // ----------------------------------------------------
  // MASTER DATA STORES
  // ----------------------------------------------------
  const [rawMembers, setRawMembers] = useState([]);
  const [rawReceipts, setRawReceipts] = useState([]);
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [], postalCodes: [] });
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Month Selection (default to current month)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);

  // Filter Mode: 'all-active' (all active approved members and associates)
  const [eligibilityMode, setEligibilityMode] = useState('all-active');

  // ----------------------------------------------------
  // FILTER STATES
  // ----------------------------------------------------
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'Member' | 'Associate'
  const [stateFilter, setStateFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');
  const [villageFilter, setVillageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ----------------------------------------------------
  // SELECTION & PAGINATION
  // ----------------------------------------------------
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ----------------------------------------------------
  // PRINT PREVIEW MODAL
  // ----------------------------------------------------
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRecords, setPreviewRecords] = useState([]);
  const [previewSourceTitle, setPreviewSourceTitle] = useState('');
  const printAreaRef = useRef(null);

  // Quick single label preview
  const [singleViewingRecord, setSingleViewingRecord] = useState(null);

  // ----------------------------------------------------
  // LOAD MASTER DATA
  // ----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchMembers({ limit: 5000 }),
      fetchReceipts({ limit: 5000 }),
      loadLocations(),
      loadMembershipTypes()
    ]).then(([membersRes, receiptsRes, locRes, typesRes]) => {
      if (cancelled) return;
      if (membersRes.status === 'fulfilled') setRawMembers(membersRes.value);
      if (receiptsRes.status === 'fulfilled') setRawReceipts(receiptsRes.value);
      if (locRes.status === 'fulfilled') setLocations(locRes.value);
      if (typesRes.status === 'fulfilled') setMembershipTypes(typesRes.value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Quick location lookups
  const stateMap = useMemo(() => new Map(locations.states.map((s) => [String(s.id), s.name])), [locations.states]);
  const districtMap = useMemo(() => new Map(locations.districts.map((d) => [String(d.id), d.name])), [locations.districts]);
  const talukMap = useMemo(() => new Map(locations.taluks.map((t) => [String(t.id), t.name])), [locations.taluks]);

  // ----------------------------------------------------
  // DEPENDENT DROPDOWNS: DISTRICTS, TALUKS, VILLAGES
  // ----------------------------------------------------
  const availableDistricts = useMemo(() => {
    if (stateFilter === 'ALL') return locations.districts;
    return locations.districts.filter((d) => String(d.stateId) === String(stateFilter));
  }, [locations.districts, stateFilter]);

  const availableTaluks = useMemo(() => {
    if (districtFilter === 'ALL') {
      if (stateFilter === 'ALL') return locations.taluks;
      return locations.taluks.filter((t) => String(t.stateId) === String(stateFilter));
    }
    return locations.taluks.filter((t) => String(t.districtId) === String(districtFilter));
  }, [locations.taluks, districtFilter, stateFilter]);

  // Handle cascading filter changes
  const handleStateChange = (e) => {
    setStateFilter(e.target.value);
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setVillageFilter('ALL');
    setCurrentPage(1);
  };

  const handleDistrictChange = (e) => {
    setDistrictFilter(e.target.value);
    setTalukFilter('ALL');
    setVillageFilter('ALL');
    setCurrentPage(1);
  };

  const handleTalukChange = (e) => {
    setTalukFilter(e.target.value);
    setVillageFilter('ALL');
    setCurrentPage(1);
  };

  // ----------------------------------------------------
  // EXTRACT ELIGIBLE RECORDS (MEMBERS & ASSOCIATES) FOR SELECTED MONTH
  // ----------------------------------------------------
  // Rules applied:
  // 1. Receipt integration: Map each receipt to its assigned member.
  // 2. Eligibility for month:
  //    - Assigned membership receipt dated in selected month (receiptDate startsWith selectedMonth), OR
  //    - Registration in selected month (created_at / registrationDate startsWith selectedMonth), OR
  //    - In 'all-active' mode: all active approved members and associates.
  // 3. Deduplication: One unique label per person within the print batch.
  // 4. Distinction: Members have membership numbers; Associates are clearly labeled without fake numbers.
  const eligibleRecords = useMemo(() => {
    if (!rawMembers.length) return [];

    // Map memberId -> latest receipt info
    const receiptsByMember = new Map();
    rawReceipts.forEach((r) => {
      if (r.memberId == null) return;
      const memId = String(r.memberId);
      const existing = receiptsByMember.get(memId) || [];
      existing.push(r);
      receiptsByMember.set(memId, existing);
    });

    const recordsMap = new Map();

    rawMembers.forEach((m) => {
      const isApproved = m.approvalStatus === 'APPROVED' || m.status === 'Active';
      const mReceipts = receiptsByMember.get(String(m.id)) || [];
      const hasReceipt = mReceipts.length > 0;

      // Dates associated with this member
      const regDate = String(m.registrationDate || m.created_at || '').slice(0, 10);
      const hasReceiptInMonth = mReceipts.some((r) => String(r.receiptDate || '').startsWith(selectedMonth));
      const hasRegInMonth = regDate.startsWith(selectedMonth);

      // Eligibility check
      let isEligible = false;
      if (eligibilityMode === 'month-only') {
        // Person had an assigned receipt or registered during the selected month
        isEligible = hasReceiptInMonth || hasRegInMonth;
      } else {
        // 'all-active': all paid or approved members
        isEligible = isApproved || hasReceipt;
      }

      if (!isEligible) return;

      // Resolved Location names
      const stateName = m.stateName || stateMap.get(String(m.stateId)) || '';
      const districtName = m.districtName || districtMap.get(String(m.districtId)) || '';
      const talukName = m.talukName || talukMap.get(String(m.talukId)) || '';
      const village = m.village || m.place || m.locality || m.post || m.grama || '';
      const pinCode = m.postalCode || m.pinCode || '';
      const addressLine = m.addressLine || m.address || '';

      // Resolve Membership Type (e.g. Poshaka, Mahaposhaka, Life Member, etc.)
      let resolvedType = '';
      if (membershipTypes.length > 0 && rawReceipts.length > 0) {
        const memStatus = calculateMemberMembershipStatus(m, rawReceipts, membershipTypes);
        if (memStatus && memStatus.currentMembershipType && memStatus.currentMembershipType !== 'None') {
          resolvedType = memStatus.currentMembershipType;
        }
      }
      if (!resolvedType) {
        const matchedMaster = membershipTypes.find(
          (t) => String(t.id) === String(m.membership_type_id || m.membershipTypeId)
        );
        resolvedType =
          matchedMaster?.name ||
          m.membership_type ||
          m.membershipType ||
          m.membership_type_name ||
          m.membershipTypeCategory ||
          m.category ||
          'Poshaka';
      }

      // 1. Primary Member Record
      const memberRecord = {
        id: `mem_${m.id}`,
        rawId: m.id,
        type: resolvedType,
        membershipType: resolvedType,
        name: m.fullName || m.name || '—',
        membershipNumber: m.membershipNumber || m.member_code || '',
        stateId: m.stateId ? String(m.stateId) : '',
        stateName,
        districtId: m.districtId ? String(m.districtId) : '',
        districtName,
        talukId: m.talukId ? String(m.talukId) : '',
        talukName,
        village,
        pinCode,
        addressLine,
        mobile: m.mobile || m.mobileNumber || m.phone || '',
        activityDate: hasReceiptInMonth ? (mReceipts.find((r) => String(r.receiptDate).startsWith(selectedMonth))?.receiptDate || regDate) : regDate,
        hasPaidReceipt: hasReceipt
      };

      if (!recordsMap.has(memberRecord.id)) {
        recordsMap.set(memberRecord.id, memberRecord);
      }

      // 2. Associate Record (if applicable)
      // Associates exist if applied on behalf of family, family category, or family associate specified
      const hasAssociateData =
        (m.category && String(m.category).toLowerCase().includes('family')) ||
        (m.appliedOnBehalfOf && m.appliedOnBehalfOf !== 'Self') ||
        Boolean(m.familyMembership && String(m.familyMembership).trim() !== '' && m.familyMembership !== '—');

      if (hasAssociateData) {
        let assocName = '';
        if (m.appliedOnBehalfOf && m.appliedOnBehalfOf !== 'Self') {
          assocName = `${m.appliedOnBehalfOf} of ${memberRecord.name}`;
        } else if (m.familyMembership) {
          assocName = String(m.familyMembership).replace(/^.*?-\s*/, '').trim();
        } else {
          assocName = `${memberRecord.name} (Associate)`;
        }

        const associateRecord = {
          id: `assoc_${m.id}`,
          rawId: m.id,
          type: 'Associate',
          name: assocName,
          membershipNumber: '', // Strictly NO fake or misleading membership number
          stateId: memberRecord.stateId,
          stateName: memberRecord.stateName,
          districtId: memberRecord.districtId,
          districtName: memberRecord.districtName,
          talukId: memberRecord.talukId,
          talukName: memberRecord.talukName,
          village: memberRecord.village,
          pinCode: memberRecord.pinCode,
          addressLine: memberRecord.addressLine,
          mobile: memberRecord.mobile,
          membershipType: 'Associate',
          associatedWith: memberRecord.name,
          activityDate: memberRecord.activityDate,
          hasPaidReceipt: hasReceipt
        };

        if (!recordsMap.has(associateRecord.id)) {
          recordsMap.set(associateRecord.id, associateRecord);
        }
      }
    });

    return Array.from(recordsMap.values());
  }, [rawMembers, rawReceipts, selectedMonth, eligibilityMode, stateMap, districtMap, talukMap, membershipTypes]);

  // Unique villages available from the current eligible list for dependent dropdown
  const availableVillages = useMemo(() => {
    const list = eligibleRecords.filter((r) => {
      if (stateFilter !== 'ALL' && String(r.stateId) !== String(stateFilter)) return false;
      if (districtFilter !== 'ALL' && String(r.districtId) !== String(districtFilter)) return false;
      if (talukFilter !== 'ALL' && String(r.talukId) !== String(talukFilter)) return false;
      return true;
    });
    const villages = new Set();
    list.forEach((r) => {
      if (r.village && r.village.trim()) villages.add(r.village.trim());
    });
    return Array.from(villages).sort();
  }, [eligibleRecords, stateFilter, districtFilter, talukFilter]);

  // Available membership types for filtering
  const availableMembershipTypes = useMemo(() => {
    const typesSet = new Set();
    (membershipTypes || []).forEach((t) => {
      if (t.name) typesSet.add(t.name);
    });
    (eligibleRecords || []).forEach((r) => {
      const t = r.membershipType || r.type;
      if (t && t !== 'Member') typesSet.add(t);
    });
    return Array.from(typesSet).sort();
  }, [membershipTypes, eligibleRecords]);

  // ----------------------------------------------------
  // FILTERED RECORDS (BY SEARCH AND ACTIVE DROPDOWNS)
  // ----------------------------------------------------
  const filteredRecords = useMemo(() => {
    return eligibleRecords.filter((rec) => {
      // 1. Type Filter
      if (typeFilter !== 'ALL') {
        const itemType = String(rec.membershipType || rec.type || '').trim().toLowerCase();
        if (itemType !== String(typeFilter).trim().toLowerCase()) return false;
      }

      // 2. State Filter
      if (stateFilter !== 'ALL' && String(rec.stateId) !== String(stateFilter)) return false;

      // 3. District Filter
      if (districtFilter !== 'ALL' && String(rec.districtId) !== String(districtFilter)) return false;

      // 4. Taluk Filter
      if (talukFilter !== 'ALL' && String(rec.talukId) !== String(talukFilter)) return false;

      // 5. Village Filter
      if (villageFilter !== 'ALL' && (rec.village || '').toLowerCase() !== villageFilter.toLowerCase()) return false;

      // 6. Search Filter (Name, Membership Number, Mobile)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(rec.name || '').toLowerCase().includes(q);
        const matchesNo = String(rec.membershipNumber || '').toLowerCase().includes(q);
        const matchesMobile = String(rec.mobile || '').includes(q);
        const matchesPlace = String(rec.village || '').toLowerCase().includes(q) || String(rec.talukName || '').toLowerCase().includes(q);

        if (!matchesName && !matchesNo && !matchesMobile && !matchesPlace) {
          return false;
        }
      }

      return true;
    });
  }, [eligibleRecords, typeFilter, stateFilter, districtFilter, talukFilter, villageFilter, searchQuery]);

  // Filtered Count and Eligible Counts
  const totalEligibleCount = eligibleRecords.length;
  const filteredCount = filteredRecords.length;

  // Selected Count (strictly intersection of selectedIds and filteredRecords to ensure predictable printing)
  const currentlySelectedRecords = useMemo(() => {
    return filteredRecords.filter((rec) => selectedIds.has(rec.id));
  }, [filteredRecords, selectedIds]);

  const selectedCount = currentlySelectedRecords.length;

  // ----------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // ----------------------------------------------------
  // SELECTION HANDLERS
  // ----------------------------------------------------
  const isAllFilteredSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every((r) => selectedIds.has(r.id));
  }, [filteredRecords, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect all currently filtered records
      const next = new Set(selectedIds);
      filteredRecords.forEach((r) => next.delete(r.id));
      setSelectedIds(next);
    } else {
      // Select all currently filtered records
      const next = new Set(selectedIds);
      filteredRecords.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSingle = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    notify('Selection cleared.');
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredRecords.forEach((r) => next.add(r.id));
    setSelectedIds(next);
    notify(`Selected all ${filteredRecords.length} filtered records.`);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setTypeFilter('ALL');
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setVillageFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
    notify('Filters reset to default.');
  };

  // Month navigation helpers
  const handleStepMonth = (direction) => {
    const current = selectedMonth || getCurrentYearMonth();
    const [y, m] = current.split('-').map(Number);
    const d = new Date(y || new Date().getFullYear(), (m || 1) - 1 + direction, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
    setSelectedIds(new Set()); // clear previous month selection
    setCurrentPage(1);
  };

  // ----------------------------------------------------
  // PRINT ACTIONS & PREVIEW
  // ----------------------------------------------------
  const handleOpenPrintSelected = () => {
    if (selectedCount === 0) {
      notify('Please select at least one record to print.', 'error');
      return;
    }
    setPreviewRecords(currentlySelectedRecords);
    setPreviewSourceTitle(`Selected Records (${selectedCount})`);
    setPreviewModalOpen(true);
  };

  const handleOpenPrintAllFiltered = () => {
    if (filteredCount === 0) {
      notify('No records available to print in current filter.', 'error');
      return;
    }
    setPreviewRecords(filteredRecords);
    setPreviewSourceTitle(`All Filtered Records (${filteredCount})`);
    setPreviewModalOpen(true);
  };

  const handleExecutePrint = () => {
    window.print();
  };

  return (
    <PermissionGate required="members.list.read">
      <div className="space-y-6 pb-16 font-sans">
        {/* ============================================================ */}
        {/* A. PAGE HEADING                                              */}
        {/* ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
              Label Print
            </h1>
          </div>

          {/* Quick Month Navigator in Header */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-1.5 rounded-xl border border-[#E8DFD8] shadow-xs">
            <button
              type="button"
              onClick={() => handleStepMonth(-1)}
              className="p-1.5 rounded-lg text-[#863221] hover:bg-[#FAF7F2] hover:text-[#510601] transition-colors cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-4 h-4 text-[#510601]" />
              <input
                type="month"
                required
                value={selectedMonth || getCurrentYearMonth()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setSelectedMonth(val);
                  setSelectedIds(new Set());
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                  }
                }}
                className="text-xs sm:text-sm font-bold text-[#180200] bg-transparent border-none focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => handleStepMonth(1)}
              className="p-1.5 rounded-lg text-[#863221] hover:bg-[#FAF7F2] hover:text-[#510601] transition-colors cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* C. FILTERS SECTION                                           */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E8DFD8] p-3 sm:p-3.5 shadow-xs">
          <div className="flex flex-wrap items-end gap-2 xl:gap-2.5">
            {/* 1. Type Filter */}
            <div className="flex-1 min-w-[110px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1 truncate" title="Membership Type">
                Membership Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] focus:outline-none focus:border-[#510601] transition-colors cursor-pointer"
              >
                <option value="ALL">All Types</option>
                {availableMembershipTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. State Filter */}
            <div className="flex-1 min-w-[95px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1">
                State
              </label>
              <select
                value={stateFilter}
                onChange={handleStateChange}
                className="w-full px-2.5 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] focus:outline-none focus:border-[#510601] transition-colors cursor-pointer"
              >
                <option value="ALL">All States</option>
                {locations.states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. District Filter (Dependent on State) */}
            <div className="flex-1 min-w-[105px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1">
                District
              </label>
              <select
                value={districtFilter}
                onChange={handleDistrictChange}
                className="w-full px-2.5 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] focus:outline-none focus:border-[#510601] transition-colors cursor-pointer"
              >
                <option value="ALL">All Districts</option>
                {availableDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Taluk Filter (Dependent on District) */}
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1">
                Taluk
              </label>
              <select
                value={talukFilter}
                onChange={handleTalukChange}
                className="w-full px-2.5 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] focus:outline-none focus:border-[#510601] transition-colors cursor-pointer"
              >
                <option value="ALL">All Taluks</option>
                {availableTaluks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Village Filter (Dependent on Taluk) */}
            <div className="flex-1 min-w-[110px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1 truncate" title="Village / Locality">
                Village / Locality
              </label>
              <select
                value={villageFilter}
                onChange={(e) => {
                  setVillageFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-xs font-semibold text-[#180200] focus:outline-none focus:border-[#510601] transition-colors cursor-pointer"
              >
                <option value="ALL">All Villages</option>
                {availableVillages.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Search Box */}
            <div className="flex-[1.3] min-w-[140px]">
              <label className="block text-[11px] font-semibold text-[#863221] mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#863221]/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Name, number, mobile..."
                  className="w-full pl-8 pr-7 py-1.5 h-[34px] bg-[#FAF7F2] hover:bg-white focus:bg-white border border-[#E8DFD8] rounded-xl text-xs text-[#180200] placeholder-[#863221]/40 focus:outline-none focus:border-[#510601] transition-colors shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#510601] p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 7. Reset Filters Button */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-[34px] px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#863221] hover:text-[#510601] hover:bg-[#FAF7F2] rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* E. ACTIONS BAR & SELECTION CONTROLS                          */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E8DFD8] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F1E7DE] text-[#510601] border border-[#E8DFD8] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Deselect All Filtered</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All Filtered ({filteredCount})</span>
                </>
              )}
            </button>

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-[#863221] hover:text-[#510601] border border-[#E8DFD8] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Selection</span>
              </button>
            )}

            <span className="text-xs text-[#863221] px-2">
              Showing <strong className="text-[#180200]">{filteredCount}</strong> records • Selected <strong className="text-[#510601]">{selectedCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Primary Action: Print Selected Labels */}
            <button
              type="button"
              onClick={handleOpenPrintSelected}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={selectedCount === 0 ? 'Select at least one record to print' : 'Print preview for selected records'}
            >
              <Printer className="w-4 h-4" />
              <span>Print Selected Labels ({selectedCount})</span>
            </button>

            {/* Secondary Action: Print All Filtered Records */}
            <button
              type="button"
              onClick={handleOpenPrintAllFiltered}
              disabled={filteredCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#510601] border border-[#510601] text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Print preview for all records currently matching active filters"
            >
              <FileText className="w-4 h-4" />
              <span>Print All Filtered ({filteredCount})</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* D. LABEL LIST TABLE                                          */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF7F2] border-b border-[#E8DFD8] text-[#863221] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-[#E8DFD8] text-[#510601] focus:ring-[#510601] cursor-pointer"
                      title="Select / Deselect all currently filtered records"
                    />
                  </th>
                  <th className="py-3 px-3.5">Name</th>
                  <th className="py-3 px-3.5">Membership Number</th>
                  <th className="py-3 px-3.5">Membership Type</th>
                  <th className="py-3 px-3.5">District</th>
                  <th className="py-3 px-3.5">Taluk</th>
                  <th className="py-3 px-3.5">Village / Locality</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD8]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-[#863221]">
                      <div className="w-10 h-10 rounded-2xl bg-[#510601]/5 text-[#510601] flex items-center justify-center mx-auto mb-2 border border-[#510601]/10 animate-pulse">
                        <Printer className="w-5 h-5 opacity-60" />
                      </div>
                      <p className="font-semibold text-sm text-[#180200]">Loading label records...</p>
                      <p className="text-xs text-[#863221] mt-0.5">Fetching membership and receipt assignments</p>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-[#863221]">
                      <div className="w-12 h-12 rounded-2xl bg-[#510601]/5 text-[#510601] flex items-center justify-center mx-auto mb-2 border border-[#510601]/10">
                        <AlertCircle className="w-6 h-6 text-[#863221]" />
                      </div>
                      <p className="font-bold text-sm text-[#180200]">No eligible records found</p>
                      <p className="text-xs text-[#863221] mt-1 max-w-md mx-auto">
                        {searchQuery || typeFilter !== 'ALL' || stateFilter !== 'ALL' || districtFilter !== 'ALL' || talukFilter !== 'ALL'
                          ? 'No records match the current filter criteria. Try resetting filters or adjusting search.'
                          : `No activity found for ${formatMonthYear(selectedMonth)}. You can change the month or switch scope to "All Active Members & Associates".`}
                      </p>
                      {eligibilityMode === 'month-only' && (
                        <button
                          type="button"
                          onClick={() => setEligibilityMode('all-active')}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FAF7F2] hover:bg-[#F1E7DE] text-[#510601] border border-[#E8DFD8] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          <span>Switch to All Active Members &amp; Associates</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => {
                    const isSelected = selectedIds.has(rec.id);

                    return (
                      <tr
                        key={rec.id}
                        className={`transition-colors ${isSelected ? 'bg-amber-50/50 hover:bg-amber-50/80' : 'hover:bg-[#FAF7F2]/60'
                          }`}
                      >
                        {/* 1. Select Checkbox */}
                        <td className="py-3 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSingle(rec.id)}
                            className="rounded border-[#E8DFD8] text-[#510601] focus:ring-[#510601] cursor-pointer"
                          />
                        </td>

                        {/* 3. Name */}
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-[#180200] text-xs sm:text-sm">
                            {rec.name}
                          </div>
                          {rec.associatedWith && (
                            <div className="text-[10px] text-[#863221] mt-0.5">
                              Assoc. with: {rec.associatedWith}
                            </div>
                          )}
                          {rec.mobile && (
                            <div className="text-[11px] text-[#863221]/80 font-mono mt-0.5">
                              {rec.mobile}
                            </div>
                          )}
                        </td>

                        {/* 4. Membership Number */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {rec.membershipNumber ? (
                            <span className="font-mono text-xs font-bold text-[#510601] bg-[#510601]/5 px-2 py-0.5 rounded border border-[#510601]/10">
                              #{rec.membershipNumber}
                            </span>
                          ) : (
                            <span className="text-[#863221]/60 italic font-mono">
                              —
                            </span>
                          )}
                        </td>

                        {/* 5. Membership Type */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#510601]/10 text-[#510601] border border-[#510601]/20">
                            <Award className="w-3 h-3 text-[#510601] shrink-0" />
                            <span>{rec.membershipType || rec.type || 'Poshaka'}</span>
                          </span>
                        </td>

                        {/* 6. District */}
                        <td className="py-3 px-3.5 font-semibold text-[#180200] whitespace-nowrap">
                          {rec.districtName || '—'}
                        </td>

                        {/* 8. Taluk */}
                        <td className="py-3 px-3.5 text-[#863221] whitespace-nowrap">
                          {rec.talukName || '—'}
                        </td>

                        {/* 9. Village / Locality */}
                        <td className="py-3 px-3.5 text-[#863221]">
                          <span className="truncate max-w-[150px] block" title={rec.village || '—'}>
                            {rec.village || '—'}
                          </span>
                          {rec.pinCode && (
                            <span className="text-[10px] font-mono text-[#863221]/70 block">
                              PIN: {rec.pinCode}
                            </span>
                          )}
                        </td>

                        {/* 10. Actions */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSingleViewingRecord(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer bg-[#FAF7F2] hover:bg-[#F1E7DE] text-[#510601] border-[#E8DFD8]"
                            title="Preview physical sticker label"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredCount > 0 && (
            <div className="p-3.5 bg-[#FAF7F2]/40 border-t border-[#E8DFD8] text-xs text-[#863221] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span>Showing</span>
                <span className="font-bold text-[#180200]">
                  {Math.min((currentPage - 1) * pageSize + 1, filteredCount)}
                </span>
                <span>to</span>
                <span className="font-bold text-[#180200]">
                  {Math.min(currentPage * pageSize, filteredCount)}
                </span>
                <span>of</span>
                <span className="font-bold text-[#180200]">{filteredCount}</span>
                <span>records</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-[#E8DFD8] text-[#180200] text-xs rounded-lg px-2 py-1 font-semibold focus:outline-none focus:border-[#510601]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-semibold text-xs text-[#180200]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded-lg border border-[#E8DFD8] bg-white text-[#863221] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 4. DEDICATED PRINT PREVIEW MODAL                             */}
        {/* ============================================================ */}
        <Modal isOpen={previewModalOpen} onClose={() => setPreviewModalOpen(false)}>
          <div
            className="bg-white rounded-2xl max-w-5xl w-full border border-[#E8DFD8] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Hidden on print) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD8] bg-[#FAF7F2] print:hidden no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#510601] text-white">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#180200]">
                    Label Print Preview
                  </h3>
                  <p className="text-xs text-[#863221]">
                    {previewSourceTitle} • {formatMonthYear(selectedMonth)} • 3 Labels Per Row (Sheet Layout)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#863221] hover:text-[#180200] hover:bg-white rounded-xl border border-[#E8DFD8] transition-colors cursor-pointer"
                >
                  Back / Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Labels ({previewRecords.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer ml-1"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Sheet Notice (Hidden on print) */}
            <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-200/80 text-xs text-amber-900 flex items-center justify-between print:hidden no-print">
              <span>
                Physical 3-column sticker sheet format (3 labels per row, pure black text). Click <strong>Print Labels</strong> to output on sheet.
              </span>
              <span className="font-bold text-[#510601]">
                Total: {previewRecords.length} Labels
              </span>
            </div>

            {/* Scrollable Printable Canvas */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-6 bg-stone-100/70 print:bg-white print:p-0" ref={printAreaRef}>
              <div className="printable-labels-grid grid grid-cols-3 print:grid-cols-3 gap-3 print:gap-3 max-w-5xl mx-auto min-w-[640px] print:min-w-0">
                {previewRecords.map((rec) => {
                  const locationParts = [rec.village, rec.talukName].filter(Boolean).join(', ');
                  const districtState = [rec.districtName, rec.stateName].filter(Boolean).join(', ');

                  return (
                    <div
                      key={rec.id}
                      className="printable-label-card bg-white rounded-lg border border-dashed border-stone-400 p-3 shadow-xs relative flex flex-col justify-between"
                      style={{
                        minHeight: '160px',
                        width: '100%',
                        margin: '0 auto',
                        backgroundColor: '#ffffff',
                        color: '#000000'
                      }}
                    >
                      {/* Organization Top Banner */}
                      <div className="border-b border-stone-300 pb-1 mb-1.5 flex items-center justify-between">
                        <span className="font-bold text-[9px] tracking-wider uppercase text-black" style={{ color: '#000000' }}>
                          Shree Akhila Havyaka Mahasabha (R.)
                        </span>
                        {rec.membershipNumber ? (
                          <span className="font-mono text-[9.5px] font-bold bg-white text-black px-1.5 py-0.5 rounded border border-black" style={{ color: '#000000' }}>
                            #{rec.membershipNumber}
                          </span>
                        ) : (
                          <span className="text-[8.5px] font-bold uppercase tracking-wider bg-white text-black px-1.5 py-0.5 rounded border border-black" style={{ color: '#000000' }}>
                            Associate
                          </span>
                        )}
                      </div>

                      {/* Recipient Details - Pure Black Text Only */}
                      <div className="space-y-0.5 text-xs text-black" style={{ color: '#000000' }}>
                        <div className="font-bold text-[12.5px] leading-snug text-black" style={{ color: '#000000' }}>
                          To: {rec.name}
                        </div>
                        {rec.addressLine && (
                          <div className="leading-tight text-[10.5px] line-clamp-2 text-black" style={{ color: '#000000' }}>
                            {rec.addressLine}
                          </div>
                        )}
                        {locationParts && (
                          <div className="text-[10.5px] leading-tight font-medium text-black" style={{ color: '#000000' }}>
                            {locationParts}
                          </div>
                        )}
                        <div className="text-[10.5px] leading-tight font-medium text-black" style={{ color: '#000000' }}>
                          {districtState}
                          {rec.pinCode ? ` - ${rec.pinCode}` : ''}
                        </div>
                      </div>

                      {/* Label Card Footer - Pure Black Text Only */}
                      <div className="border-t border-stone-300 pt-1 mt-1.5 flex items-center justify-between text-[9.5px] text-black" style={{ color: '#000000' }}>
                        <span className="font-mono text-black" style={{ color: '#000000' }}>
                          Mob: {rec.mobile || '—'}
                        </span>
                        <span className="font-semibold text-black" style={{ color: '#000000' }}>
                          {rec.type === 'Member' ? (rec.membershipType || 'Member') : 'Associate'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Bottom Footer (Hidden on print) */}
            <div className="px-6 py-3 border-t border-[#E8DFD8] bg-[#FAF7F2] flex items-center justify-between text-xs text-[#863221] print:hidden no-print">
              <span>
                Showing {previewRecords.length} labels ready for 3-in-a-row sheet printing
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="px-4 py-2 border border-[#E8DFD8] text-[#863221] hover:bg-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Labels</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* ============================================================ */}
        {/* SINGLE RECORD PREVIEW MODAL                                  */}
        {/* ============================================================ */}
        <Modal isOpen={Boolean(singleViewingRecord)} onClose={() => setSingleViewingRecord(null)}>
          {singleViewingRecord && (
            <div
              className="bg-white rounded-2xl max-w-md w-full border border-[#E8DFD8] shadow-2xl p-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#E8DFD8] pb-3 mb-4">
                <h3 className="text-sm font-bold text-[#180200]">
                  Single Label Card Preview
                </h3>
                <button
                  type="button"
                  onClick={() => setSingleViewingRecord(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Physical Card Representation - Pure Black Text on White Background */}
              <div
                className="printable-label-card bg-white rounded-lg border border-dashed border-stone-400 p-3.5 shadow-xs relative flex flex-col justify-between min-h-[160px]"
                style={{ backgroundColor: '#ffffff', color: '#000000' }}
              >
                <div className="border-b border-stone-300 pb-1 mb-1.5 flex items-center justify-between">
                  <span className="font-bold text-[9.5px] tracking-wider uppercase text-black" style={{ color: '#000000' }}>
                    Shree Akhila Havyaka Mahasabha (R.)
                  </span>
                  {singleViewingRecord.membershipNumber ? (
                    <span className="font-mono text-[9.5px] font-bold bg-white text-black px-1.5 py-0.5 rounded border border-black" style={{ color: '#000000' }}>
                      #{singleViewingRecord.membershipNumber}
                    </span>
                  ) : (
                    <span className="text-[8.5px] font-bold uppercase tracking-wider bg-white text-black px-1.5 py-0.5 rounded border border-black" style={{ color: '#000000' }}>
                      Associate
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 text-xs text-black" style={{ color: '#000000' }}>
                  <div className="font-bold text-[13px] leading-snug text-black" style={{ color: '#000000' }}>
                    To: {singleViewingRecord.name}
                  </div>
                  {singleViewingRecord.addressLine && (
                    <div className="leading-tight text-[11px] text-black" style={{ color: '#000000' }}>
                      {singleViewingRecord.addressLine}
                    </div>
                  )}
                  <div className="text-[11px] text-black font-medium" style={{ color: '#000000' }}>
                    {[singleViewingRecord.village, singleViewingRecord.talukName].filter(Boolean).join(', ')}
                  </div>
                  <div className="text-[11px] text-black font-medium" style={{ color: '#000000' }}>
                    {[singleViewingRecord.districtName, singleViewingRecord.stateName].filter(Boolean).join(', ')}
                    {singleViewingRecord.pinCode ? ` - ${singleViewingRecord.pinCode}` : ''}
                  </div>
                </div>

                <div className="border-t border-stone-300 pt-1 mt-2 flex items-center justify-between text-[9.5px] text-black" style={{ color: '#000000' }}>
                  <span className="font-mono text-black" style={{ color: '#000000' }}>
                    Mob: {singleViewingRecord.mobile || '—'}
                  </span>
                  <span className="font-semibold text-black" style={{ color: '#000000' }}>
                    {singleViewingRecord.type}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E8DFD8] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSingleViewingRecord(null)}
                  className="px-4 py-2 border border-[#E8DFD8] text-xs font-semibold text-[#863221] hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec = singleViewingRecord;
                    setSingleViewingRecord(null);
                    setPreviewRecords([rec]);
                    setPreviewSourceTitle(`Single Label (${rec.name})`);
                    setPreviewModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#510601] hover:bg-[#863221] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Print This Label
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Footer text preservation */}
        <div className="pt-8 text-center text-xs text-[#863221]/70 font-medium print:hidden no-print">
          &copy; 2026 Powered by D-apps.in, Kumbashi
        </div>
      </div>
    </PermissionGate>
  );
}
