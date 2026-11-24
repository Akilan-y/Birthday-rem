import React, {useMemo, useState} from 'react';
import {
  Award,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  User,
} from 'lucide-react';
import type {
  ComputedBirthday,
  RelationshipGroup,
  WorkspaceView,
} from '../types/birthday';
import {
  formatCountdownLabel,
  formatOrdinalAge,
  formatShortDate,
  isMilestoneAge,
  MONTH_NAMES,
} from '../utils/dateMath';
import {DashboardWidgets} from './DashboardWidgets';
import {DrivePhoto} from './DrivePhoto';
import {MonthCalendarGrid} from './MonthCalendarGrid';

interface CalendarWorkspaceProps {
  birthdays: ComputedBirthday[];
  allBirthdays?: ComputedBirthday[];
  workspaceToken?: string | null;
  onAuthExpired?: () => void;
  onOpenProfile?: (entry: ComputedBirthday) => void;
  onEdit: (entry: ComputedBirthday) => void;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onAddForDate: (month: number, day?: number) => void;
  onNavigateView: (view: WorkspaceView) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getGroupTickClass(
  group: RelationshipGroup,
  isCellToday: boolean,
  isMilestone: boolean
): string {
  if (isCellToday) return 'bg-white dark:bg-neutral-950';
  if (isMilestone || group === 'Family') return 'bg-neutral-950 dark:bg-white';
  if (group === 'Remembrance') return 'bg-neutral-400 dark:bg-neutral-600';
  return 'bg-neutral-500 dark:bg-neutral-400';
}

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  birthdays,
  allBirthdays,
  workspaceToken = null,
  onAuthExpired,
  onOpenProfile,
  onEdit,
  onToggleCelebrated,
  onAddForDate,
  onNavigateView,
}) => {
  const now = new Date();
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [displayYear, setDisplayYear] = useState(now.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(now.getMonth()); // 0-11
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  );

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(displayYear, displayMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInCurrent = new Date(displayYear, displayMonth + 1, 0).getDate();
    const daysInPrev = new Date(displayYear, displayMonth, 0).getDate();

    const cells: {
      year: number;
      month: number;
      day: number;
      inCurrentMonth: boolean;
      isToday: boolean;
      key: string;
    }[] = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const prevDate = new Date(displayYear, displayMonth - 1, d);
      cells.push({
        year: prevDate.getFullYear(),
        month: prevDate.getMonth(),
        day: d,
        inCurrentMonth: false,
        isToday:
          prevDate.getFullYear() === now.getFullYear() &&
          prevDate.getMonth() === now.getMonth() &&
          prevDate.getDate() === now.getDate(),
        key: `${prevDate.getFullYear()}-${prevDate.getMonth()}-${d}`,
      });
    }

    for (let d = 1; d <= daysInCurrent; d++) {
      cells.push({
        year: displayYear,
        month: displayMonth,
        day: d,
        inCurrentMonth: true,
        isToday:
          displayYear === now.getFullYear() &&
          displayMonth === now.getMonth() &&
          d === now.getDate(),
        key: `${displayYear}-${displayMonth}-${d}`,
      });
    }

    const remaining = cells.length <= 35 ? 35 - cells.length : 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(displayYear, displayMonth + 1, d);
      cells.push({
        year: nextDate.getFullYear(),
        month: nextDate.getMonth(),
        day: d,
        inCurrentMonth: false,
        isToday:
          nextDate.getFullYear() === now.getFullYear() &&
          nextDate.getMonth() === now.getMonth() &&
          nextDate.getDate() === now.getDate(),
        key: `${nextDate.getFullYear()}-${nextDate.getMonth()}-${d}`,
      });
    }

    return cells;
  }, [displayYear, displayMonth, now]);

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((y) => y - 1);
    } else {
      setDisplayMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((y) => y + 1);
    } else {
      setDisplayMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth());
    setSelectedDayKey(`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`);
  };

  const handleFocusBirthdayDate = (entry: ComputedBirthday) => {
    const y = entry.nextOccurrenceYear;
    const m = entry.month - 1;
    setViewMode('month');
    setDisplayYear(y);
    setDisplayMonth(m);
    setSelectedDayKey(`${y}-${m}-${entry.day}`);
  };

  const selectedCell = useMemo(() => {
    const found = calendarCells.find((c) => c.key === selectedDayKey);
    if (found) return found;
    return {
      year: displayYear,
      month: displayMonth,
      day: 1,
      inCurrentMonth: true,
      isToday: false,
      key: `${displayYear}-${displayMonth}-1`,
    };
  }, [calendarCells, selectedDayKey, displayYear, displayMonth]);

  const selectedDateBirthdays = useMemo(
    () =>
      birthdays.filter(
        (b) => b.month === selectedCell.month + 1 && b.day === selectedCell.day
      ),
    [birthdays, selectedCell]
  );

  const scheduledCards = useMemo(() => {
    const selectedIds = new Set(selectedDateBirthdays.map((b) => b.id));
    const upcomingOthers = birthdays.filter((b) => !selectedIds.has(b.id)).slice(0, 4);
    return {
      selected: selectedDateBirthdays,
      upcoming: upcomingOthers,
    };
  }, [birthdays, selectedDateBirthdays]);

  const selectedDateLabel = `${selectedCell.day} ${MONTH_NAMES[selectedCell.month]}, ${selectedCell.year}`;

  const renderScheduledCard = (entry: ComputedBirthday, highlightSelected: boolean) => {
    const isRemembrance = entry.group === 'Remembrance';
    const isMilestone = !isRemembrance && isMilestoneAge(entry.turningAge);

    return (
      <div
        key={entry.id}
        className={`rounded-lg border p-4 transition-colors ${
          highlightSelected
            ? 'border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-900'
            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {(entry.avatarThumb || entry.avatarFileId) && (
              <div className="w-9 h-9 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shrink-0">
                <DrivePhoto
                  driveFileId={entry.avatarFileId}
                  fallbackUrl={entry.avatarThumb}
                  workspaceToken={workspaceToken}
                  alt={entry.name}
                  onAuthExpired={onAuthExpired}
                />
              </div>
            )}
            <div className="min-w-0">
              {onOpenProfile ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile(entry)}
                  className="text-sm font-semibold text-neutral-950 dark:text-white hover:underline underline-offset-2 truncate block max-w-full text-left cursor-pointer"
                >
                  {entry.name}
                </button>
              ) : (
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white truncate">
                  {entry.name}
                </h4>
              )}
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                {entry.note ||
                  entry.relation ||
                  (isRemembrance ? 'In loving memory' : `${entry.group} circle`)}
              </p>
            </div>
          </div>
          {isMilestone && entry.turningAge !== null && (
            <span
              title={`${formatOrdinalAge(entry.turningAge)} Milestone`}
              className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-neutral-950 dark:text-white shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              {formatOrdinalAge(entry.turningAge)}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            {formatShortDate(entry.month, entry.day)}
            {entry.turningAge !== null &&
              (isRemembrance ? ` · ${entry.turningAge} yrs` : ` · Age ${entry.turningAge}`)}
          </span>
          <span className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100 font-medium">
            {formatCountdownLabel(entry.daysUntil)}
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {entry.group}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleCelebrated(entry)}
              className={`px-2.5 py-1 min-h-[30px] rounded-md text-[11px] font-medium inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                entry.isCelebratedThisYear
                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Check className="w-3 h-3" />
              {isRemembrance
                ? entry.isCelebratedThisYear
                  ? 'Remembered'
                  : 'Remember'
                : entry.isCelebratedThisYear
                ? 'Wished'
                : 'Wish'}
            </button>
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => onOpenProfile(entry)}
                title={`Open ${entry.name}'s profile & gallery`}
                aria-label={`Open ${entry.name}'s profile`}
                className="p-1.5 min-h-[30px] min-w-[30px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center cursor-pointer"
              >
                <User className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={`Edit ${entry.name}`}
              className="p-1.5 min-h-[30px] min-w-[30px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const widgetsBar = (
    <DashboardWidgets
      birthdays={allBirthdays ?? birthdays}
      onNavigateView={onNavigateView}
      onFocusBirthdayDate={handleFocusBirthdayDate}
      onEditBirthday={onEdit}
      onAddBirthday={() => onAddForDate(now.getMonth() + 1, now.getDate())}
    />
  );

  if (viewMode === 'year') {
    return (
      <div className="space-y-5">
        {widgetsBar}
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
              >
                Month Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('year')}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 cursor-pointer"
              >
                All 12 Months
              </button>
            </div>
          </div>
          <MonthCalendarGrid
            birthdays={birthdays}
            onEdit={onEdit}
            onAddForMonth={(m) => onAddForDate(m)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {widgetsBar}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Main Interactive Month Calendar Panel */}
        <section
          aria-label="Monthly calendar"
          className="xl:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select month"
                  value={displayMonth}
                  onChange={(e) => setDisplayMonth(Number(e.target.value))}
                  className="bg-transparent font-display text-xl font-medium text-neutral-950 dark:text-white focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option
                      key={mName}
                      value={idx}
                      className="bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white"
                    >
                      {mName}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Select year"
                  value={displayYear}
                  onChange={(e) => setDisplayYear(Number(e.target.value))}
                  className="bg-transparent text-lg font-normal font-mono tabular-nums text-neutral-500 dark:text-neutral-400 focus:outline-none cursor-pointer"
                >
                  {[displayYear - 1, displayYear, displayYear + 1, displayYear + 2].map((yr) => (
                    <option
                      key={yr}
                      value={yr}
                      className="bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white"
                    >
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 cursor-pointer"
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('year')}
                  className="px-3 py-1 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  Year
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-3 py-1.5 min-h-[34px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Header Row */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((dayName) => (
              <div
                key={dayName}
                className="text-center sm:text-left px-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate"
              >
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden">{dayName.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell) => {
              const dayBirthdays = birthdays.filter(
                (b) => b.month === cell.month + 1 && b.day === cell.day
              );
              const isSelected = cell.key === selectedCell.key;

              return (
                <div
                  key={cell.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDayKey(cell.key);
                    if (!cell.inCurrentMonth) {
                      setDisplayMonth(cell.month);
                      setDisplayYear(cell.year);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDayKey(cell.key);
                    }
                  }}
                  onDoubleClick={() => onAddForDate(cell.month + 1, cell.day)}
                  aria-label={`${MONTH_NAMES[cell.month]} ${cell.day}, ${dayBirthdays.length} birthdays`}
                  className={`group relative min-h-[76px] sm:min-h-[96px] rounded-lg p-2 sm:p-2.5 flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                    cell.isToday
                      ? 'bg-neutral-950 text-white border border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white'
                      : isSelected
                      ? 'border border-neutral-950 dark:border-white bg-neutral-100 dark:bg-neutral-900 text-neutral-950 dark:text-white'
                      : cell.inCurrentMonth
                      ? 'border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-950 dark:text-neutral-100'
                      : 'border border-neutral-200/50 dark:border-neutral-900 bg-neutral-50/70 dark:bg-neutral-950/50 text-neutral-400 dark:text-neutral-600 hover:bg-neutral-100/70 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`font-mono text-xs sm:text-sm font-medium tabular-nums ${
                        cell.isToday ? 'font-semibold' : ''
                      }`}
                    >
                      {cell.day}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddForDate(cell.month + 1, cell.day);
                      }}
                      title={`Add birthday on ${MONTH_NAMES[cell.month]} ${cell.day}`}
                      aria-label={`Add birthday on ${MONTH_NAMES[cell.month]} ${cell.day}`}
                      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded flex items-center justify-center transition-opacity cursor-pointer ${
                        cell.isToday
                          ? 'bg-white/20 text-white hover:bg-white/30 dark:bg-neutral-950/15 dark:text-neutral-950 dark:hover:bg-neutral-950/25'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {dayBirthdays.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayBirthdays.slice(0, 2).map((b) => {
                        const milestone = isMilestoneAge(b.turningAge);
                        const tickClass = getGroupTickClass(b.group, cell.isToday, milestone);
                        return (
                          <div
                            key={b.id}
                            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] leading-tight truncate"
                          >
                            <span
                              aria-hidden="true"
                              className={`w-0.5 h-3 rounded-full shrink-0 ${tickClass}`}
                            />
                            <span
                              className={`truncate font-medium ${
                                cell.isToday
                                  ? 'text-white dark:text-neutral-950'
                                  : 'text-neutral-800 dark:text-neutral-200'
                              }`}
                            >
                              {b.name}
                            </span>
                          </div>
                        );
                      })}
                      {dayBirthdays.length > 2 && (
                        <p
                          className={`text-[10px] font-mono tabular-nums ${
                            cell.isToday
                              ? 'text-white/75 dark:text-neutral-950/75'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          +{dayBirthdays.length - 2} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right "Scheduled" Agenda Sidebar */}
        <aside
          aria-label="Scheduled birthdays"
          className="xl:col-span-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5"
        >
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-lg font-medium text-neutral-950 dark:text-white">
                Scheduled
              </h2>
              <p className="mt-0.5 text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                {selectedDateLabel}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleJumpToday}
                title="Jump to today"
                aria-label="Jump to today"
                className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center cursor-pointer"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onAddForDate(selectedCell.month + 1, selectedCell.day)}
                title="Add birthday on selected date"
                aria-label="Add birthday on selected date"
                className="w-8 h-8 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Selected Date Entries */}
          <div className="mt-4">
            <p className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 mb-2.5">
              Selected Date ({scheduledCards.selected.length})
            </p>
            {scheduledCards.selected.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-4 text-center">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  No birthdays on {MONTH_NAMES[selectedCell.month]} {selectedCell.day}.
                </p>
                <button
                  type="button"
                  onClick={() => onAddForDate(selectedCell.month + 1, selectedCell.day)}
                  className="mt-2 text-xs font-medium text-neutral-950 dark:text-white underline underline-offset-2 cursor-pointer"
                >
                  + Add for this date
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledCards.selected.map((entry) => renderScheduledCard(entry, true))}
              </div>
            )}
          </div>

          {/* Upcoming Soon Cards */}
          {scheduledCards.upcoming.length > 0 && (
            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 mb-3">
                Coming Up Next
              </p>
              <div className="space-y-3">
                {scheduledCards.upcoming.map((entry) => renderScheduledCard(entry, false))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
