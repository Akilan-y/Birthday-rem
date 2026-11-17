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
import {MonthCalendarGrid} from './MonthCalendarGrid';

interface CalendarWorkspaceProps {
  birthdays: ComputedBirthday[];
  allBirthdays?: ComputedBirthday[];
  onEdit: (entry: ComputedBirthday) => void;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onAddForDate: (month: number, day?: number) => void;
  onNavigateView: (view: WorkspaceView) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getGroupBarColor(group: RelationshipGroup, isToday: boolean, isMilestone: boolean): string {
  if (isToday) return '#F97316'; // Warm coral
  if (isMilestone) return '#A3E635'; // Luminous lime-moss
  switch (group) {
    case 'Family':
      return '#34D399';
    case 'Friends':
      return '#1D8FE1';
    case 'Colleagues':
      return '#FBBF24';
    case 'Community':
      return '#38BDF8';
  }
}

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  birthdays,
  allBirthdays,
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

  // Build 42-cell (6-week) calendar grid including leading/trailing month days
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(displayYear, displayMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInCurrent = new Date(displayYear, displayMonth + 1, 0).getDate();
    const daysInPrev = new Date(displayYear, displayMonth, 0).getDate();

    const cells: {
      year: number;
      month: number; // 0-11
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

  // Upcoming items to show in the right-hand Scheduled rail (prioritizing selected day, then upcoming)
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
    const isMilestone = isMilestoneAge(entry.turningAge);

    return (
      <div
        key={entry.id}
        className={`rounded-xl border p-4 transition-colors ${
          highlightSelected
            ? 'border-[#38BDF8]/40 bg-[#1D8FE1]/10'
            : 'border-slate-200 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.045]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {entry.name}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {entry.note || `${entry.group} circle`}
            </p>
          </div>
          {isMilestone && entry.turningAge !== null && (
            <span
              title={`${formatOrdinalAge(entry.turningAge)} Milestone`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300 shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              {formatOrdinalAge(entry.turningAge)}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            {formatShortDate(entry.month, entry.day)}
            {entry.turningAge !== null && ` · Age ${entry.turningAge}`}
          </span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
            {formatCountdownLabel(entry.daysUntil)}
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {entry.group}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleCelebrated(entry)}
              className={`px-2.5 py-1 min-h-[32px] rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                entry.isCelebratedThisYear
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200/70 dark:bg-white/[0.07] text-slate-700 dark:text-slate-200 hover:bg-slate-300/70 dark:hover:bg-white/[0.14]'
              }`}
            >
              <Check className="w-3 h-3" />
              {entry.isCelebratedThisYear ? 'Wished' : 'Wish'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={`Edit ${entry.name}`}
              className="p-1.5 min-h-[32px] min-w-[32px] rounded-lg bg-slate-200/70 dark:bg-white/[0.07] text-slate-700 dark:text-slate-200 hover:bg-slate-300/70 dark:hover:bg-white/[0.14] transition-colors inline-flex items-center justify-center cursor-pointer"
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
            <div className="flex items-center gap-2 p-1 rounded-full bg-slate-200/70 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07]">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Month Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('year')}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1D8FE1] text-white cursor-pointer"
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
          className="xl:col-span-8 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-4 sm:p-6"
        >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <select
                aria-label="Select month"
                value={displayMonth}
                onChange={(e) => setDisplayMonth(Number(e.target.value))}
                className="bg-transparent text-lg font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option
                    key={mName}
                    value={idx}
                    className="bg-white dark:bg-[#1B2330] text-slate-900 dark:text-white"
                  >
                    {mName}
                  </option>
                ))}
              </select>

              <select
                aria-label="Select year"
                value={displayYear}
                onChange={(e) => setDisplayYear(Number(e.target.value))}
                className="bg-transparent text-lg font-medium font-mono tabular-nums text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                {[displayYear - 1, displayYear, displayYear + 1, displayYear + 2].map((yr) => (
                  <option
                    key={yr}
                    value={yr}
                    className="bg-white dark:bg-[#1B2330] text-slate-900 dark:text-white"
                  >
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-full bg-slate-200/70 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07]">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className="px-3 py-1 rounded-full text-xs font-medium bg-[#1D8FE1] text-white cursor-pointer"
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setViewMode('year')}
                className="px-3 py-1 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Year
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleJumpToday}
              className="px-3 py-1.5 min-h-[36px] rounded-full border border-slate-200 dark:border-white/[0.09] bg-white/70 dark:bg-white/[0.05] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="w-9 h-9 rounded-full border border-slate-200 dark:border-white/[0.09] bg-white/70 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="w-9 h-9 rounded-full border border-slate-200 dark:border-white/[0.09] bg-white/70 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] inline-flex items-center justify-center transition-colors cursor-pointer"
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
              className="text-center sm:text-left px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate"
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
                className={`group relative min-h-[76px] sm:min-h-[96px] rounded-xl p-2 sm:p-2.5 flex flex-col justify-between transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                  cell.isToday
                    ? 'bg-gradient-to-b from-[#2388E6] to-[#1A4B7C] text-white border border-[#38BDF8]/60 shadow-[0_8px_20px_rgba(29,143,225,0.28)]'
                    : isSelected
                    ? 'border border-dashed border-[#38BDF8] bg-[#1D8FE1]/15 text-slate-900 dark:text-white'
                    : cell.inCurrentMonth
                    ? 'border border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                    : 'border border-slate-200/60 dark:border-white/[0.03] bg-slate-100/40 dark:bg-white/[0.015] text-slate-400 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`font-mono text-xs sm:text-sm font-medium tabular-nums ${
                      cell.isToday ? 'text-white' : ''
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
                    className={`opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded-md flex items-center justify-center transition-opacity cursor-pointer ${
                      cell.isToday
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-slate-200/80 dark:bg-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-[#1D8FE1] hover:text-white'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {dayBirthdays.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dayBirthdays.slice(0, 2).map((b) => {
                      const milestone = isMilestoneAge(b.turningAge);
                      const tickColor = getGroupBarColor(b.group, b.isToday, milestone);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center gap-1.5 text-[10px] sm:text-[11px] leading-tight truncate"
                        >
                          <span
                            aria-hidden="true"
                            className="w-0.5 h-3 rounded-full shrink-0"
                            style={{backgroundColor: tickColor}}
                          />
                          <span
                            className={`truncate font-medium ${
                              cell.isToday
                                ? 'text-white/95'
                                : 'text-slate-700 dark:text-slate-200'
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
                          cell.isToday ? 'text-white/80' : 'text-slate-400'
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
        className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-5"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Scheduled
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedDateLabel}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleJumpToday}
              title="Jump to today"
              aria-label="Jump to today"
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/[0.09] bg-white/70 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] inline-flex items-center justify-center cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAddForDate(selectedCell.month + 1, selectedCell.day)}
              title="Add birthday on selected date"
              aria-label="Add birthday on selected date"
              className="w-8 h-8 rounded-full bg-[#1D8FE1] hover:bg-[#197CC6] text-white inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selected Date Entries */}
        <div className="mt-4">
          <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-2.5">
            Selected Date ({scheduledCards.selected.length})
          </p>
          {scheduledCards.selected.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] p-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No birthdays on {MONTH_NAMES[selectedCell.month]} {selectedCell.day}.
              </p>
              <button
                type="button"
                onClick={() => onAddForDate(selectedCell.month + 1, selectedCell.day)}
                className="mt-2 text-xs font-medium text-[#1D8FE1] dark:text-[#38BDF8] hover:underline cursor-pointer"
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
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/[0.07]">
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-3">
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
