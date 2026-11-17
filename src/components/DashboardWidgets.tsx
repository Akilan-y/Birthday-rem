import React, {useMemo} from 'react';
import {ArrowUpRight, CalendarClock, Plus, UserPlus, Users} from 'lucide-react';
import type {ComputedBirthday, WorkspaceView} from '../types/birthday';
import {
  formatCountdownLabel,
  formatShortDate,
  isMilestoneAge,
} from '../utils/dateMath';

interface DashboardWidgetsProps {
  birthdays: ComputedBirthday[];
  onNavigateView: (view: WorkspaceView) => void;
  onFocusBirthdayDate: (entry: ComputedBirthday) => void;
  onEditBirthday: (entry: ComputedBirthday) => void;
  onAddBirthday: () => void;
}

function formatAddedRelative(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return 'Recently';
  const diffDays = Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Added today';
  if (diffDays === 1) return 'Added yesterday';
  if (diffDays <= 7) return `Added ${diffDays}d ago`;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  birthdays,
  onNavigateView,
  onFocusBirthdayDate,
  onEditBirthday,
  onAddBirthday,
}) => {
  const stats = useMemo(() => {
    const totalCount = birthdays.length;
    const thisMonthCount = birthdays.filter((b) => b.isThisMonth).length;
    const milestoneCount = birthdays.filter((b) => isMilestoneAge(b.turningAge)).length;

    const upcomingThisWeek = [...birthdays]
      .filter((b) => b.isThisWeek)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));

    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byNewest = [...birthdays].sort((a, b) => {
      const timeA = Date.parse(a.createdAt) || 0;
      const timeB = Date.parse(b.createdAt) || 0;
      return timeB - timeA;
    });

    const recentAdditionsCount = byNewest.filter((b) => {
      const createdMs = Date.parse(b.createdAt);
      return !Number.isNaN(createdMs) && createdMs >= sevenDaysAgoMs;
    }).length;

    return {
      totalCount,
      thisMonthCount,
      milestoneCount,
      upcomingThisWeekCount: upcomingThisWeek.length,
      soonestThisWeek: upcomingThisWeek[0] ?? null,
      recentAdditionsCount,
      latestAdded: byNewest[0] ?? null,
    };
  }, [birthdays]);

  return (
    <section
      aria-label="Quick overview widgets"
      className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/[0.07]">
        {/* Widget 1: Total birthdays */}
        <button
          type="button"
          onClick={() => onNavigateView('upcoming')}
          className="group p-4 sm:p-5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.04] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#38BDF8]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Users className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
              <span>Total birthdays</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1D8FE1] dark:group-hover:text-[#38BDF8] transition-colors" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {stats.totalCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {stats.totalCount === 1 ? 'saved entry' : 'saved entries'}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
            {stats.totalCount > 0 ? (
              <>
                {stats.thisMonthCount} this month
                <span aria-hidden="true"> · </span>
                {stats.milestoneCount}{' '}
                {stats.milestoneCount === 1 ? 'milestone' : 'milestones'}
              </>
            ) : (
              'Open upcoming directory'
            )}
          </p>
        </button>

        {/* Widget 2: Upcoming this week */}
        <button
          type="button"
          onClick={() => {
            if (stats.soonestThisWeek) {
              onFocusBirthdayDate(stats.soonestThisWeek);
            } else {
              onNavigateView('upcoming');
            }
          }}
          className="group p-4 sm:p-5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.04] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#38BDF8]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CalendarClock className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
              <span>Upcoming this week</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1D8FE1] dark:group-hover:text-[#38BDF8] transition-colors" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {stats.upcomingThisWeekCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              within 7 days
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
            {stats.soonestThisWeek ? (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {stats.soonestThisWeek.name}
                </span>
                <span aria-hidden="true"> · </span>
                <span
                  className={
                    stats.soonestThisWeek.isToday
                      ? 'text-[#1D8FE1] dark:text-[#38BDF8] font-medium'
                      : ''
                  }
                >
                  {formatCountdownLabel(stats.soonestThisWeek.daysUntil)}
                </span>
                <span aria-hidden="true"> · </span>
                <span>
                  {formatShortDate(
                    stats.soonestThisWeek.month,
                    stats.soonestThisWeek.day
                  )}
                </span>
              </>
            ) : (
              'Quiet week ahead · View upcoming'
            )}
          </p>
        </button>

        {/* Widget 3: Recently added */}
        <button
          type="button"
          onClick={() => {
            if (stats.latestAdded) {
              onEditBirthday(stats.latestAdded);
            } else {
              onAddBirthday();
            }
          }}
          className="group p-4 sm:p-5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.04] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#38BDF8]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <UserPlus className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
              <span>Recently added</span>
            </span>
            {stats.latestAdded ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1D8FE1] dark:group-hover:text-[#38BDF8] transition-colors" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
            )}
          </div>

          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {stats.recentAdditionsCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              in the last 7 days
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
            {stats.latestAdded ? (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {stats.latestAdded.name}
                </span>
                <span aria-hidden="true"> · </span>
                <span>
                  {formatShortDate(stats.latestAdded.month, stats.latestAdded.day)}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{formatAddedRelative(stats.latestAdded.createdAt)}</span>
              </>
            ) : (
              'Add your first birthday entry'
            )}
          </p>
        </button>
      </div>
    </section>
  );
};
