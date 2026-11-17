import React from 'react';
import {Award, Check, Leaf} from 'lucide-react';
import type {ComputedBirthday} from '../types/birthday';
import {
  formatCountdownLabel,
  formatOrdinalAge,
  formatShortDate,
  formatTodayHeader,
  isMilestoneAge,
} from '../utils/dateMath';

interface SpotlightHeroProps {
  birthdays: ComputedBirthday[];
  vaultBytes: number;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onOpenAddModal: () => void;
}

export const SpotlightHero: React.FC<SpotlightHeroProps> = ({
  birthdays,
  vaultBytes,
  onToggleCelebrated,
  onOpenAddModal,
}) => {
  const nextBirthday = birthdays[0] ?? null;
  const isNextMilestone = nextBirthday ? isMilestoneAge(nextBirthday.turningAge) : false;

  const upcomingMilestones = birthdays.filter((b) => isMilestoneAge(b.turningAge));
  const nextSecondaryMilestone =
    upcomingMilestones.find((b) => b.id !== nextBirthday?.id) ?? null;

  const totalCount = birthdays.length;
  const thisMonthCount = birthdays.filter((b) => b.isThisMonth).length;
  const next30DaysCount = birthdays.filter((b) => b.daysUntil <= 30).length;
  const formattedSize =
    vaultBytes < 1024 ? `${vaultBytes} B` : `${(vaultBytes / 1024).toFixed(1)} KB`;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Leaf className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
            <span>{formatTodayHeader()}</span>
            <span aria-hidden="true">·</span>
            <span>Local-only keepsake</span>
            {nextBirthday && isNextMilestone && nextBirthday.turningAge !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-300">
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Milestone · {formatOrdinalAge(nextBirthday.turningAge)} Birthday
                  </span>
                </span>
              </>
            )}
          </p>

          {nextBirthday ? (
            <div className="mt-3">
              <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                {nextBirthday.isToday
                  ? isNextMilestone && nextBirthday.turningAge !== null
                    ? `${nextBirthday.name} turns ${nextBirthday.turningAge} today.`
                    : `${nextBirthday.name}'s birthday is today.`
                  : isNextMilestone && nextBirthday.turningAge !== null
                  ? `${nextBirthday.name}'s ${formatOrdinalAge(nextBirthday.turningAge)} milestone is ${formatCountdownLabel(nextBirthday.daysUntil).toLowerCase()}.`
                  : `${nextBirthday.name} is next, ${formatCountdownLabel(nextBirthday.daysUntil).toLowerCase()}.`}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {formatShortDate(nextBirthday.month, nextBirthday.day)}
                {nextBirthday.turningAge !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span
                      className={`tabular-nums ${
                        isNextMilestone
                          ? 'font-medium text-amber-600 dark:text-amber-300'
                          : ''
                      }`}
                    >
                      Turning {nextBirthday.turningAge}
                      {isNextMilestone ? ' (Milestone)' : ''}
                    </span>
                  </>
                )}
                <span aria-hidden="true"> · </span>
                <span>{nextBirthday.group}</span>
                {nextBirthday.note && (
                  <>
                    <span aria-hidden="true"> — </span>
                    <span>{nextBirthday.note}</span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                A quiet place to remember the people who matter.
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Every birthday stays on your device with offline reminders and zero data collection.
              </p>
            </div>
          )}
        </div>

        {nextBirthday ? (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onToggleCelebrated(nextBirthday)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                nextBirthday.isCelebratedThisYear
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.12]'
              }`}
            >
              <Check className="w-4 h-4" />
              {nextBirthday.isCelebratedThisYear ? 'Wish Recorded' : 'Mark Wish Sent'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Add First Birthday
            </button>
          </div>
        )}
      </div>

      {/* Upcoming Milestone Radar Strip */}
      {nextSecondaryMilestone && nextSecondaryMilestone.turningAge !== null && (
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
            <Award className="w-4 h-4 text-amber-500 dark:text-amber-300 shrink-0" />
            <span className="font-medium text-amber-600 dark:text-amber-300">
              Upcoming Milestone
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {nextSecondaryMilestone.name}
            </span>
            <span>
              turns{' '}
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                {nextSecondaryMilestone.turningAge}
              </span>{' '}
              on {formatShortDate(nextSecondaryMilestone.month, nextSecondaryMilestone.day)}
            </span>
          </div>
          <span className="font-mono tabular-nums text-amber-600 dark:text-amber-300 shrink-0">
            {formatCountdownLabel(nextSecondaryMilestone.daysUntil)}
          </span>
        </div>
      )}

      {/* 4-column unboxed tabular metric strip */}
      <dl className="mt-5 pt-5 border-t border-slate-200 dark:border-white/[0.06] grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Saved Birthdays</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
            {totalCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">This Month</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
            {thisMonthCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Next 30 Days</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
            {next30DaysCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Upcoming Milestones</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
            {upcomingMilestones.length}
            <span className="ml-2 font-sans text-xs font-normal text-slate-500 dark:text-slate-400">
              ({formattedSize})
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
};
