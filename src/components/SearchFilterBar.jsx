import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

export default function SearchFilterBar({
  title,
  breadcrumb,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = '',
  activeFiltersCount = 0,
  onResetFilters,
  children,
  rightSlot,
  leftSlot,
  className = ''
}) {
  const hasSearchOrFilters = (onSearchChange !== undefined) || children;

  return (
    <div className={`space-y-4 w-full ${className}`}>
      {/* Optional Breadcrumb */}
      {breadcrumb && (
        <div>
          {breadcrumb}
        </div>
      )}

      {/* Title Row: Title on Left, Action Buttons on Right */}
      {(title || leftSlot || rightSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Title / Left Area */}
          <div className="flex items-center gap-3 min-w-0">
            {typeof title === 'string' ? (
              <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight">{title}</h1>
            ) : (
              title
            )}
            {leftSlot}
          </div>

          {/* Right Action Buttons Slot */}
          {rightSlot && (
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
              {rightSlot}
            </div>
          )}
        </div>
      )}

      {/* Search, Filter List, and Refresh Card */}
      {hasSearchOrFilters && (
        <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            
            {/* Search Box */}
            {onSearchChange !== undefined && (
              <div className="relative w-full sm:w-48 md:w-52 shrink-0">
                <Search className="w-4 h-4 text-[#863221]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder || 'Search...'}
                  className="w-full pl-9 pr-7 py-2 text-xs sm:text-sm bg-white border border-[#E8DFD8] rounded-2xl focus:outline-none focus:border-[#510601] focus:ring-1 focus:ring-[#510601] text-[#180200] placeholder-[#863221]/40 transition-colors shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#510601] p-0.5 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Filter List (Dropdowns etc.) */}
            {children}

            {/* Refresh / Reset Filters Button */}
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium text-[#863221] hover:text-[#510601] bg-white hover:bg-[#FAF7F2] rounded-2xl border border-[#E8DFD8] hover:border-[#863221]/40 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#863221]" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
