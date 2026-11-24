import React, {useMemo, useState} from 'react';
import {Check, CheckSquare, Pencil, Plus, Search, Square, Trash2, User, X} from 'lucide-react';
import type {
  ComputedBirthday,
  RelationshipGroup,
  SortMode,
  UpcomingFilter,
} from '../types/birthday';
import {
  formatCompactCountdown,
  formatCountdownLabel,
  formatShortDate,
  getCountdownCycleStats,
} from '../utils/dateMath';
import {DrivePhoto} from './DrivePhoto';

interface UpcomingListProps {
  birthdays: ComputedBirthday[];
  totalSavedCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  groupFilter: UpcomingFilter;
  onGroupFilterChange: (group: UpcomingFilter) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  workspaceToken?: string | null;
  onAuthExpired?: () => void;
  onOpenProfile?: (entry: ComputedBirthday) => void;
  onEdit: (entry: ComputedBirthday) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onBulkReassignGroup: (ids: string[], group: RelationshipGroup) => Promise<void> | void;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onOpenAddModal: () => void;
}

const FILTER_OPTIONS: UpcomingFilter[] = [
  'All',
  'Within 30 Days',
  'Family',
  'Friends',
  'Remembrance',
];

const RELATIONSHIP_GROUPS: RelationshipGroup[] = [
  'Family',
  'Friends',
  'Remembrance',
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
  workspaceToken = null,
  onAuthExpired,
  onOpenProfile,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkReassignGroup,
  onToggleCelebrated,
  onOpenAddModal,
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
        <div className="flex items-baseline justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-display text-sm font-medium text-neutral-950 dark:text-white">
            {title}
          </h3>
          <span className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {items.length} {items.length === 1 ? 'person' : 'people'}
          </span>
        </div>

        <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
          {items.map((entry) => {
            const isDeleting = confirmDeleteId === entry.id;
            const isSelected = selectedIds.has(entry.id);
            const cycleStats = getCountdownCycleStats(entry);
            const progressScale = entry.isToday
              ? 1
              : Math.max(0.04, cycleStats.progressRatio);
            const progressBarColor =
              entry.isToday || entry.daysUntil <= 7
                ? 'bg-neutral-950 dark:bg-white'
                : 'bg-neutral-500 dark:bg-neutral-400';

            return (
              <li
                key={entry.id}
                onClick={isSelectionMode ? () => toggleSelectRow(entry.id) : undefined}
                className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-colors ${
                  isSelectionMode
                    ? 'cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-900 -mx-2 px-2 rounded-lg'
                    : ''
                } ${
                  isSelectionMode && isSelected
                    ? 'bg-neutral-100 dark:bg-neutral-900'
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
                      className={`min-h-[40px] min-w-[40px] rounded-lg inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                        isSelected
                          ? 'text-neutral-950 dark:text-white'
                          : 'text-neutral-400 dark:text-neutral-600'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  ) : onOpenProfile ? (
                    <button
                      type="button"
                      onClick={() => onOpenProfile(entry)}
                      title={`Open ${entry.name}'s profile & gallery`}
                      aria-label={`Open ${entry.name}'s profile`}
                      className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                        entry.isToday
                          ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                      }`}
                    >
                      <DrivePhoto
                        driveFileId={entry.avatarFileId}
                        fallbackUrl={entry.avatarThumb}
                        workspaceToken={workspaceToken}
                        alt={entry.name}
                        onAuthExpired={onAuthExpired}
                        fallback={<span>{getInitials(entry.name)}</span>}
                      />
                    </button>
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0 border ${
                        entry.isToday
                          ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <DrivePhoto
                        driveFileId={entry.avatarFileId}
                        fallbackUrl={entry.avatarThumb}
                        workspaceToken={workspaceToken}
                        alt={entry.name}
                        onAuthExpired={onAuthExpired}
                        fallback={<span>{getInitials(entry.name)}</span>}
                      />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      {onOpenProfile && !isSelectionMode ? (
                        <button
                          type="button"
                          onClick={() => onOpenProfile(entry)}
                          className="text-sm sm:text-base font-medium text-neutral-950 dark:text-white hover:underline underline-offset-2 truncate text-left cursor-pointer"
                        >
                          {entry.name}
                        </button>
                      ) : (
                        <span className="text-sm sm:text-base font-medium text-neutral-950 dark:text-white truncate">
                          {entry.name}
                        </span>
                      )}
                      {entry.isToday && (
                        <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-neutral-950 dark:text-white">
                          Today
                        </span>
                      )}
                      {!entry.isToday && entry.daysUntil <= 7 && (
                        <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                          {formatCountdownLabel(entry.daysUntil)}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="tabular-nums">
                        {formatShortDate(entry.month, entry.day)}
                      </span>
                      {entry.turningAge !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {entry.group === 'Remembrance'
                              ? `${entry.turningAge} yrs`
                              : `Turning ${entry.turningAge}`}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          entry.group === 'Remembrance'
                            ? 'italic text-neutral-600 dark:text-neutral-300'
                            : undefined
                        }
                      >
                        {entry.group}
                      </span>
                      {entry.relation && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[140px]">{entry.relation}</span>
                        </>
                      )}
                      {(entry.galleryPhotos?.length ?? 0) > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {entry.galleryPhotos?.length}{' '}
                            {entry.galleryPhotos?.length === 1 ? 'photo' : 'photos'}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {entry.advanceDays === 0
                          ? 'Alert on day'
                          : `Alert ${entry.advanceDays}d prior`}
                      </span>
                    </div>

                    {entry.note && (
                      <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pl-14 sm:pl-0">
                  <div
                    className="flex flex-col items-start sm:items-end min-w-[64px]"
                    title={
                      entry.isToday
                        ? 'Today (100% of year cycle)'
                        : `${cycleStats.remainingDays} ${
                            cycleStats.remainingDays === 1 ? 'day' : 'days'
                          } left · ${cycleStats.percentComplete}% of year elapsed`
                    }
                  >
                    <span
                      className={`font-mono text-sm font-medium tabular-nums leading-none ${
                        entry.isToday || entry.daysUntil <= 7
                          ? 'text-neutral-950 dark:text-white font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {formatCompactCountdown(entry.daysUntil)}
                    </span>
                    <div
                      role="progressbar"
                      aria-label={`Year progress until ${entry.name}`}
                      aria-valuemin={0}
                      aria-valuemax={cycleStats.totalDays}
                      aria-valuenow={cycleStats.elapsedDays}
                      aria-valuetext={
                        entry.isToday
                          ? 'Today'
                          : `${cycleStats.remainingDays} days remaining, ${cycleStats.percentComplete} percent elapsed`
                      }
                      className="mt-1.5 h-1.5 w-16 rounded-sm bg-neutral-200 dark:bg-neutral-800 overflow-hidden"
                    >
                      <div
                        className={`h-full w-full origin-left ${progressBarColor} transition-transform duration-300 ease-out motion-reduce:transition-none`}
                        style={{transform: `scaleX(${progressScale})`}}
                      />
                    </div>
                  </div>

                  {!isSelectionMode && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleCelebrated(entry)}
                        title={
                          entry.group === 'Remembrance'
                            ? entry.isCelebratedThisYear
                              ? 'Remembrance marked'
                              : 'Mark remembered'
                            : entry.isCelebratedThisYear
                            ? 'Wish recorded'
                            : 'Mark wish sent'
                        }
                        aria-label={
                          entry.group === 'Remembrance'
                            ? entry.isCelebratedThisYear
                              ? `Undo remembrance marked for ${entry.name}`
                              : `Mark remembered for ${entry.name}`
                            : entry.isCelebratedThisYear
                            ? `Undo wish recorded for ${entry.name}`
                            : `Mark wish sent for ${entry.name}`
                        }
                        className={`min-h-[36px] min-w-[36px] px-2.5 rounded-lg border inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                          entry.isCelebratedThisYear
                            ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                            : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">
                          {entry.group === 'Remembrance'
                            ? entry.isCelebratedThisYear
                              ? 'Remembered'
                              : 'Remember'
                            : entry.isCelebratedThisYear
                            ? 'Wished'
                            : 'Wish'}
                        </span>
                      </button>

                      {onOpenProfile && (
                        <button
                          type="button"
                          onClick={() => onOpenProfile(entry)}
                          title={`Open ${entry.name}'s profile & gallery`}
                          aria-label={`Profile for ${entry.name}`}
                          className="min-h-[36px] min-w-[36px] rounded-lg inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        aria-label={`Edit ${entry.name}`}
                        className="min-h-[36px] min-w-[36px] rounded-lg inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1 pl-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(entry.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[36px] px-3 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            aria-label="Cancel delete"
                            className="min-h-[36px] min-w-[36px] rounded-lg inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={`Delete ${entry.name}`}
                          className="min-h-[36px] min-w-[36px] rounded-lg inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6"
    >
      {/* Search, group filter tabs, sort, and bulk select toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:max-w-xs">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or gift note..."
            aria-label="Search birthdays"
            className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Filter upcoming birthdays"
            className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto max-w-full"
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
                  className={`px-3 py-1 min-h-[30px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
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
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
              >
                <option value="soonest" className="bg-white dark:bg-neutral-900">
                  Sort: Soonest
                </option>
                <option value="alphabetical" className="bg-white dark:bg-neutral-900">
                  Sort: Name (A–Z)
                </option>
                <option value="month" className="bg-white dark:bg-neutral-900">
                  Sort: Month
                </option>
              </select>
            </label>

            {birthdays.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectionMode}
                aria-pressed={isSelectionMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                  isSelectionMode
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
          className="mt-4 px-4 py-3 rounded-lg border border-neutral-950/30 dark:border-white/25 bg-neutral-50 dark:bg-neutral-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 min-h-[36px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {allVisibleSelected
                ? 'Deselect All'
                : `Select All (${birthdays.length})`}
            </button>
            <span className="font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
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
                className="min-h-[36px] px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium text-neutral-950 dark:text-white disabled:opacity-50 focus:outline-none cursor-pointer"
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
                className="px-3.5 py-1.5 min-h-[36px] rounded-md bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
              >
                Reassign
              </button>
            </div>

            {confirmBulkDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="px-3.5 py-1.5 min-h-[36px] rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirm Delete ({visibleSelectedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-3 py-1.5 min-h-[36px] rounded-md border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={visibleSelectedIds.length === 0}
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-md border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty States */}
      {totalSavedCount === 0 ? (
        <div className="mt-8 py-12 px-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-center">
          <h3 className="font-display text-xl font-medium text-neutral-950 dark:text-white">
            Your birthday book is empty
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Add birthdays manually whenever someone comes to mind. Everything stays offline in your browser vault.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Birthday
          </button>
        </div>
      ) : birthdays.length === 0 ? (
        <div className="mt-8 py-10 px-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-center">
          <h3 className="font-display text-lg font-medium text-neutral-950 dark:text-white">
            No matching birthdays
          </h3>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            Try clearing your search term or switching back to the All filter.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onGroupFilterChange('All');
            }}
            className="mt-5 px-4 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
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
