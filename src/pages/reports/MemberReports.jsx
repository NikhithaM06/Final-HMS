import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ApprovedMembersReport from './ApprovedMembersReport';
import UnapprovedMembersReport from './UnapprovedMembersReport';
import { loadLocations } from '../../utils/serverData';
import {
  Search,
  X,
  RotateCcw,
  ChevronDown,
  UserCheck,
  UserX
} from 'lucide-react';
import clsx from 'clsx';

export default function MemberReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'approved';
  // Keep only 'approved' and 'unapproved' views
  const currentTab = rawTab === 'unapproved' ? 'unapproved' : 'approved';

  // Common Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [locations, setLocations] = useState({ states: [], districts: [], taluks: [] });

  // Load Geographic Locations (Districts & Taluks)
  useEffect(() => {
    let cancelled = false;
    loadLocations()
      .then((loc) => {
        if (!cancelled && loc) {
          setLocations(loc);
        }
      })
      .catch((err) => {
        console.error('Failed to load locations for member report filters:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Dependent Taluks: Restrict taluks to selected district
  const availableTaluks = useMemo(() => {
    if (districtFilter === 'ALL') return locations.taluks || [];
    return (locations.taluks || []).filter((t) => String(t.districtId) === String(districtFilter));
  }, [locations.taluks, districtFilter]);

  // Handle District Change: changing district clears previously selected taluk if no longer valid
  const handleDistrictChange = (e) => {
    const newDistrict = e.target.value;
    setDistrictFilter(newDistrict);
    if (newDistrict === 'ALL') {
      setTalukFilter('ALL');
    } else {
      const validTaluks = (locations.taluks || []).filter((t) => String(t.districtId) === String(newDistrict));
      const isStillValid = validTaluks.some((t) => String(t.id) === String(talukFilter));
      if (!isStillValid) {
        setTalukFilter('ALL');
      }
    }
  };

  // Reset Filters: restores search and all dropdowns to default values
  const handleResetFilters = () => {
    setSearchQuery('');
    setDistrictFilter('ALL');
    setTalukFilter('ALL');
    setGenderFilter('ALL');
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* 1. Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">
            Member Report
          </h1>

        </div>
      </div>

      {/* 2. Two Tabs / View Selectors */}
      <div className="bg-[#FAF7F2] p-1.5 rounded-2xl border border-[#E8DFD8] inline-flex items-center gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setTab('approved')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer',
            currentTab === 'approved'
              ? 'bg-[#510601] text-white shadow-xs'
              : 'text-[#863221] hover:bg-white hover:text-[#510601]'
          )}
        >
          <UserCheck className="w-4 h-4" />
          <span>Approved Members</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('unapproved')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer',
            currentTab === 'unapproved'
              ? 'bg-[#510601] text-white shadow-xs'
              : 'text-[#863221] hover:bg-white hover:text-[#510601]'
          )}
        >
          <UserX className="w-4 h-4" />
          <span>Unapproved Members</span>
        </button>
      </div>

      {/* 3. Search Bar, Dropdown Filters, and Reset Button */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-[#863221]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name, number, phone, location..."
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-white border border-[#E8DFD8] rounded-xl focus:outline-none focus:border-[#510601] focus:ring-1 focus:ring-[#510601] text-[#180200] placeholder-[#863221]/40 transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#510601] p-0.5 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* All Districts Dropdown */}
          <div className="relative">
            <select
              value={districtFilter}
              onChange={handleDistrictChange}
              className="appearance-none pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-[#180200] focus:outline-none focus:border-[#510601] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="ALL">All Districts</option>
              {(locations.districts || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* All Taluks Dropdown */}
          <div className="relative">
            <select
              value={talukFilter}
              onChange={(e) => setTalukFilter(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-[#180200] focus:outline-none focus:border-[#510601] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="ALL">All Taluks</option>
              {availableTaluks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* All Genders Dropdown */}
          <div className="relative">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium bg-[#FAF7F2] hover:bg-white border border-[#E8DFD8] rounded-xl text-[#180200] focus:outline-none focus:border-[#510601] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="ALL">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#863221]/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Small Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-semibold text-[#863221] hover:text-[#ED4636] hover:bg-red-50 rounded-xl border border-[#E8DFD8] hover:border-red-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0"
            title="Reset all filters and search query"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 4. Display Relevant Member Table Below Filters */}
      <div>
        {currentTab === 'approved' && (
          <ApprovedMembersReport
            hideNavHeader={true}
            hideSearchInput={true}
            searchQuery={searchQuery}
            districtFilter={districtFilter}
            talukFilter={talukFilter}
            genderFilter={genderFilter}
            locations={locations}
          />
        )}
        {currentTab === 'unapproved' && (
          <UnapprovedMembersReport
            hideNavHeader={true}
            hideSearchInput={true}
            hideInternalFilters={true}
            searchQuery={searchQuery}
            districtFilter={districtFilter}
            talukFilter={talukFilter}
            genderFilter={genderFilter}
            locations={locations}
          />
        )}
      </div>
    </div>
  );
}
