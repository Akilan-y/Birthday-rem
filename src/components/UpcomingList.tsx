import React, {useMemo, useState} from 'react';
import {Check, CheckSquare, Pencil, Plus, Search, Square, Trash2, X} from 'lucide-react';
import type {ComputedBirthday, RelationshipGroup, SortMode} from '../types/birthday';
import {
  formatCompactCountdown,
  formatCountdownLabel,
  formatShortDate,
} from '../utils/dateMath';

interface UpcomingListProps {
  birthdays: ComputedBirthday[];
  totalSavedCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  groupFilter: 'All' | RelationshipGroup;
  onGroupFilterChange: (group: 'All' | RelationshipGroup) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  onEdit: (entry: ComputedBirthday) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onBulkReassignGroup: (ids: string[], group: RelationshipGroup) => Promise<void> | void;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onOpenAddModal: () => void;
  onClearSeeded?: () => void;
  hasOnlySeeded?: boolean;
}

const FILTER_OPTIONS: ('All' | RelationshipGroup)[] = [
  'All',
  'Family',
  'Friends',
  'Colleagues',
  'Community',
];

const RELATIONSHIP_GROUPS: RelationshipGroup[] = [
  'Family',
  'Friends',
  'Colleagues',
  'Community',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const UpcomingList: React.FC<UpcomingListProps> = ({
  birthdays,
  totalSavedCount,
  searchQuery,
  onSearchChange,
  groupFilter,
  onGroupFilterChange,
  sortMode,
  onSortModeChange,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkReassignGroup,
  onToggleCelebrated,
  onOpenAddModal,
  onClearSeeded,
  hasOnlySeeded,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [targetGroup, setTargetGroup] = useState<RelationshipGroup>('Friends');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const visibleSelectedIds = useMemo(
    () => birthdays.filter((b) => selectedIds.has(b.id)).map((b) => b.id),
    [birthdays, selectedIds]
  );

  const allVisibleSelected =
    birthdays.length > 0 && visibleSelectedIds.length === birthdays.length;

  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setConfirmBulkDelete(false);
      } else {
        setConfirmDeleteId(null);
      }
      return !prev;
    });
  };

  const toggleSelectRow = (id: string) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setConfirmBulkDelete(false);
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(birthdays.map((b) => b.id)));
    }
  };

  const handleApplyBulkReassign = async () => {
    if (visibleSelectedIds.length === 0) return;
    await onBulkReassignGroup(visibleSelectedIds, targetGroup);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setConfirmBulkDelete(false);
  };

  const handleConfirmBulkDelete = async () => {
    if (visibleSelectedIds.length === 0) return;
    await onBulkDelete(visibleSelectedIds);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setIsSelectionMode(false);
  };

  const renderSection = (title: string, items: ComputedBirthday[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mt-7 first:mt-4">
        <div className="flex items-baseline justify-between pb-2 border-b border-slate-200 dark:border-white/[0.08]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {items.length} {items.length === 1 ? 'person' : 'people'}
          </span>
        </div>

        <ul className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
          {items.map((entry) => {
            const isDeleting = confirmDeleteId === entry.id;
            const isSelected = selectedIds.has(entry.id);

            return (
              <li
                key={entry.id}
                onClick={isSelectionMode ? () => toggleSelectRow(entry.id) : undefined}
                className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-colors ${
                  isSelectionMode
                    ? 'cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/[0.04] -mx-2 px-2 rounded-xl'
                    : ''
                } ${
                  isSelectionMode && isSelected
                    ? 'bg-[#1D8FE1]/10 dark:bg-[#1D8FE1]/15'
                    : ''
                }`}
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  {isSelectionMode ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Select ${entry.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(entry.id);
                      }}
                      className={`min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                        isSelected
                          ? 'text-[#1D8FE1] dark:text-[#38BDF8]'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border ${
                        entry.isToday
                          ? 'bg-[#1D8FE1] text-white border-[#38BDF8]/50'
                          : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08]'
                      }`}
                    >
                      {getInitials(entry.name)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-sm sm:text-base font-medium text-slate-900 dark:text-white truncate">
                        {entry.name}
                      </span>
                      {entry.isToday && (
                        <span className="text-xs font-semibold text-[#1D8FE1] dark:text-[#38BDF8]">
                          Today
                        </span>
                      )}
                      {!entry.isToday && entry.daysUntil <= 7 && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-300">
                          {formatCountdownLabel(entry.daysUntil)}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">
                        {formatShortDate(entry.month, entry.day)}
                      </span>
                      {entry.turningAge !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Turning {entry.turningAge}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{entry.group}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {entry.advanceDays === 0
                          ? 'Alert on day'
                          : `Alert ${entry.advanceDays}d prior`}
                      </span>
                    </div>

                    {entry.note && (
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-14 sm:pl-0">
                  <span
                    className={`font-mono text-sm font-medium tabular-nums min-w-[48px] text-left sm:text-right ${
                      entry.isToday
                        ? 'text-[#1D8FE1] dark:text-[#38BDF8]'
                        : entry.daysUntil <= 7
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {formatCompactCountdown(entry.daysUntil)}
                  </span>

                  {!isSelectionMode && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleCelebrated(entry)}
                        title={entry.isCelebratedThisYear ? 'Wish recorded' : 'Mark wish sent'}
                        aria-label={
                          entry.isCelebratedThisYear
                            ? `Undo wish recorded for ${entry.name}`
                            : `Mark wish sent for ${entry.name}`
                        }
                        className={`min-h-[40px] min-w-[40px] px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                          entry.isCelebratedThisYear
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span className="hidden lg:inline">
                          {entry.isCelebratedThisYear ? 'Wished' : 'Wish'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        aria-label={`Edit ${entry.name}`}
                        className="min-h-[40px] min-w-[40px] rounded-xl inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1 pl-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(entry.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[40px] px-3 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            aria-label="Cancel delete"
                            className="min-h-[40px] min-w-[40px] rounded-xl inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={`Delete ${entry.name}`}
                          className="min-h-[40px] min-w-[40px] rounded-xl inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const todayItems = birthdays.filter((b) => b.daysUntil === 0);
  const weekItems = birthdays.filter((b) => b.daysUntil >= 1 && b.daysUntil <= 7);
  const monthItems = birthdays.filter((b) => b.daysUntil > 7 && b.daysUntil <= 30);
  const laterItems = birthdays.filter((b) => b.daysUntil > 30);

  return (
    <section
      aria-label="Birthday list"
      className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-5 sm:p-6"
    >
      {/* Search, group filter tabs, sort, and bulk select toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or gift note..."
            aria-label="Search birthdays"
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter by circle"
            className="flex items-center gap-1 p-1 rounded-full bg-slate-200/70 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07] overflow-x-auto max-w-full"
          >
            {FILTER_OPTIONS.map((group) => {
              const active = groupFilter === group;
              return (
                <button
                  key={group}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onGroupFilterChange(group)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1D8FE1] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs">
              <span className="sr-only">Sort birthdays</span>
              <select
                value={sortMode}
                onChange={(e) => onSortModeChange(e.target.value as SortMode)}
                aria-label="Sort birthdays"
                className="min-h-[40px] px-3.5 py-2 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8] cursor-pointer"
              >
                <option value="soonest" className="bg-white dark:bg-[#1B2330]">
                  Sort: Soonest
                </option>
                <option value="alphabetical" className="bg-white dark:bg-[#1B2330]">
                  Sort: Name (A–Z)
                </option>
                <option value="month" className="bg-white dark:bg-[#1B2330]">
                  Sort: Month
                </option>
              </select>
            </label>

            {birthdays.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectionMode}
                aria-pressed={isSelectionMode}
                className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                  isSelectionMode
                    ? 'border-[#38BDF8] bg-[#1D8FE1]/15 text-[#1D8FE1] dark:text-[#38BDF8]'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {isSelectionMode ? 'Done' : 'Select'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {isSelectionMode && birthdays.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="mt-4 px-4 py-3 rounded-xl border border-[#38BDF8]/30 bg-[#1D8FE1]/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 min-h-[38px] rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] text-xs font-medium text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/[0.12] transition-colors whitespace-nowrap cursor-pointer"
            >
              {allVisibleSelected
                ? 'Deselect All'
                : `Select All (${birthdays.length})`}
            </button>
            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
              {visibleSelectedIds.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <label htmlFor="bulk-group-select" className="sr-only">
                Reassign relationship circle
              </label>
              <select
                id="bulk-group-select"
                value={targetGroup}
                disabled={visibleSelectedIds.length === 0}
                onChange={(e) => setTargetGroup(e.target.value as RelationshipGroup)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white/80 dark:bg-[#1B2330] text-xs font-medium text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] cursor-pointer"
              >
                {RELATIONSHIP_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    Move to {g}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={visibleSelectedIds.length === 0}
                onClick={handleApplyBulkReassign}
                className="px-3.5 py-2 min-h-[38px] rounded-lg bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
              >
                Reassign
              </button>
            </div>

            {confirmBulkDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="px-3.5 py-2 min-h-[38px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirm Delete ({visibleSelectedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-3 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/10 whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={visibleSelectedIds.length === 0}
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-rose-500/30 text-xs font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-500/15 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {hasOnlySeeded && onClearSeeded && (
        <div className="mt-5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-100/60 dark:bg-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Showing four starter examples stored locally on your device. Edit them or start with a blank list.
          </p>
          <button
            type="button"
            onClick={onClearSeeded}
            className="text-xs font-medium text-[#1D8FE1] dark:text-[#38BDF8] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Clear starter examples
          </button>
        </div>
      )}

      {/* Empty States */}
      {totalSavedCount === 0 ? (
        <div className="mt-8 py-12 px-6 rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-center">
          <h3 className="font-display text-xl font-medium text-slate-900 dark:text-white">
            Your birthday book is empty
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Add birthdays manually whenever someone comes to mind. Everything stays offline in your browser vault.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Birthday
          </button>
        </div>
      ) : birthdays.length === 0 ? (
        <div className="mt-8 py-10 px-6 rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-center">
          <h3 className="font-display text-lg font-medium text-slate-900 dark:text-white">
            No matching birthdays
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Try clearing your search term or switching back to All circles.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onGroupFilterChange('All');
            }}
            className="mt-5 px-4 py-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-white/[0.08] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : sortMode === 'soonest' ? (
        <div>
          {renderSection('Today', todayItems)}
          {renderSection('Next 7 Days', weekItems)}
          {renderSection('Within 30 Days', monthItems)}
          {renderSection('Later This Year', laterItems)}
        </div>
      ) : (
        <div>
          {renderSection(
            sortMode === 'alphabetical' ? 'All Birthdays (A–Z)' : 'Calendar Order',
            birthdays
          )}
        </div>
      )}
    </section>
  );
};
