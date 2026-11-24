import React from 'react';
import {Award, Check, Clock, Leaf} from 'lucide-react';
import type {ComputedBirthday} from '../types/birthday';
import {
  formatCountdownLabel,
  formatOrdinalAge,
  formatShortDate,
  formatTodayHeader,
  getCountdownCycleStats,
  isMilestoneAge,
} from '../utils/dateMath';

interface SpotlightHeroProps {
  birthdays: ComputedBirthday[];
  vaultBytes: number;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onOpenAddModal: () => void;
  onOpenProfile?: (entry: ComputedBirthday) => void;
}

export const SpotlightHero: React.FC<SpotlightHeroProps> = ({
  birthdays,
  vaultBytes,
  onToggleCelebrated,
  onOpenAddModal,
  onOpenProfile,
}) => {
  const nextBirthday = birthdays[0] ?? null;
  const isNextRemembrance = nextBirthday?.group === 'Remembrance';
  const isNextMilestone =
    nextBirthday && !isNextRemembrance ? isMilestoneAge(nextBirthday.turningAge) : false;

  const upcomingMilestones = birthdays.filter(
    (b) => b.group !== 'Remembrance' && isMilestoneAge(b.turningAge)
  );
  const nextSecondaryMilestone =
    upcomingMilestones.find((b) => b.id !== nextBirthday?.id) ?? null;

  const totalCount = birthdays.length;
  const thisMonthCount = birthdays.filter((b) => b.isThisMonth).length;
  const next30DaysCount = birthdays.filter((b) => b.daysUntil <= 30).length;
  const formattedSize =
    vaultBytes < 1024 ? `${vaultBytes} B` : `${(vaultBytes / 1024).toFixed(1)} KB`;

  const cycleStats = nextBirthday ? getCountdownCycleStats(nextBirthday) : null;
  const visualBarScale = cycleStats
    ? nextBirthday?.isToday
      ? 1
      : Math.max(0.02, cycleStats.progressRatio)
    : 0;

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Leaf className="w-3.5 h-3.5 text-neutral-950 dark:text-white" />
            <span>{formatTodayHeader()}</span>
            <span aria-hidden="true">·</span>
            <span>Local-only keepsake</span>
            {nextBirthday && isNextMilestone && nextBirthday.turningAge !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-950 dark:text-white">
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
              <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-neutral-950 dark:text-white [text-wrap:balance]">
                {nextBirthday.isToday
                  ? isNextRemembrance
                    ? `Remembering ${nextBirthday.name} today.`
                    : isNextMilestone && nextBirthday.turningAge !== null
                    ? `${nextBirthday.name} turns ${nextBirthday.turningAge} today.`
                    : `${nextBirthday.name}'s birthday is today.`
                  : isNextRemembrance
                  ? `${nextBirthday.name} is remembered ${formatCountdownLabel(nextBirthday.daysUntil).toLowerCase()}.`
                  : isNextMilestone && nextBirthday.turningAge !== null
                  ? `${nextBirthday.name}'s ${formatOrdinalAge(nextBirthday.turningAge)} milestone is ${formatCountdownLabel(nextBirthday.daysUntil).toLowerCase()}.`
                  : `${nextBirthday.name} is next, ${formatCountdownLabel(nextBirthday.daysUntil).toLowerCase()}.`}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {formatShortDate(nextBirthday.month, nextBirthday.day)}
                {nextBirthday.turningAge !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span
                      className={`tabular-nums ${
                        isNextMilestone
                          ? 'font-medium text-neutral-950 dark:text-white'
                          : ''
                      }`}
                    >
                      {isNextRemembrance
                        ? `${nextBirthday.turningAge} yrs in memory`
                        : `Turning ${nextBirthday.turningAge}`}
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
              <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-neutral-950 dark:text-white [text-wrap:balance]">
                A quiet place to remember the people who matter.
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Every birthday stays on your device with offline reminders and zero data collection.
              </p>
            </div>
          )}
        </div>

        {nextBirthday ? (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => onOpenProfile(nextBirthday)}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-950 dark:text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
              >
                Open Page
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleCelebrated(nextBirthday)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                nextBirthday.isCelebratedThisYear
                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                  : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-950 dark:text-white border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Check className="w-4 h-4" />
              {isNextRemembrance
                ? nextBirthday.isCelebratedThisYear
                  ? 'Remembered'
                  : 'Mark Remembered'
                : nextBirthday.isCelebratedThisYear
                ? 'Wish Recorded'
                : 'Mark Wish Sent'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Add First Birthday
            </button>
          </div>
        )}
      </div>

      {/* Countdown Visualizer */}
      {nextBirthday && cycleStats && (
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
              <Clock className="w-3.5 h-3.5 text-neutral-950 dark:text-white" />
              <span>
                {nextBirthday.isToday
                  ? isNextRemembrance
                    ? 'Remembrance Day Arrived'
                    : 'Celebration Day'
                  : 'Countdown Progress'}
              </span>
            </span>

            <span className="font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
              {nextBirthday.isToday ? (
                <span className="font-semibold text-neutral-950 dark:text-white">
                  0 days left · 100%
                </span>
              ) : (
                <>
                  <span className="font-semibold text-neutral-950 dark:text-white">
                    {cycleStats.remainingDays}{' '}
                    {cycleStats.remainingDays === 1 ? 'day' : 'days'} left
                  </span>
                  <span aria-hidden="true" className="mx-1.5 text-neutral-400">
                    ·
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {cycleStats.elapsedDays}/{cycleStats.totalDays}d ({cycleStats.percentComplete}%)
                  </span>
                </>
              )}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={`Annual countdown for ${nextBirthday.name}`}
            aria-valuemin={0}
            aria-valuemax={cycleStats.totalDays}
            aria-valuenow={cycleStats.elapsedDays}
            aria-valuetext={
              nextBirthday.isToday
                ? 'Today'
                : `${cycleStats.remainingDays} days remaining, ${cycleStats.percentComplete} percent of year elapsed`
            }
            className="mt-2.5 relative h-2 w-full rounded-sm bg-neutral-200 dark:bg-neutral-800 overflow-hidden"
          >
            <div
              className="h-full w-full origin-left bg-neutral-950 dark:bg-white transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{transform: `scaleX(${visualBarScale})`}}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-1/4 w-px bg-white/60 dark:bg-black/40 pointer-events-none"
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-1/2 w-px bg-white/60 dark:bg-black/40 pointer-events-none"
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-3/4 w-px bg-white/60 dark:bg-black/40 pointer-events-none"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            <span>
              {formatShortDate(nextBirthday.month, nextBirthday.day)}, {cycleStats.previousYear}
            </span>
            <span className="font-sans text-neutral-500 dark:text-neutral-400">
              {nextBirthday.advanceDays === 0
                ? 'Reminder on the day'
                : `Reminder ${nextBirthday.advanceDays}d prior`}
            </span>
            <span>
              {formatShortDate(nextBirthday.month, nextBirthday.day)},{' '}
              {nextBirthday.nextOccurrenceYear}
            </span>
          </div>
        </div>
      )}

      {/* Upcoming Milestone Radar Strip */}
      {nextSecondaryMilestone && nextSecondaryMilestone.turningAge !== null && (
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-neutral-600 dark:text-neutral-300">
            <Award className="w-4 h-4 text-neutral-950 dark:text-white shrink-0" />
            <span className="font-medium text-neutral-950 dark:text-white">
              Upcoming Milestone
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-neutral-950 dark:text-white">
              {nextSecondaryMilestone.name}
            </span>
            <span>
              turns{' '}
              <span className="font-mono tabular-nums font-medium text-neutral-950 dark:text-white">
                {nextSecondaryMilestone.turningAge}
              </span>{' '}
              on {formatShortDate(nextSecondaryMilestone.month, nextSecondaryMilestone.day)}
            </span>
          </div>
          <span className="font-mono tabular-nums font-medium text-neutral-950 dark:text-white shrink-0">
            {formatCountdownLabel(nextSecondaryMilestone.daysUntil)}
          </span>
        </div>
      )}

      {/* 4-column unboxed tabular metric strip */}
      <dl className="mt-5 pt-5 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Saved Birthdays</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-neutral-950 dark:text-white">
            {totalCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">This Month</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-neutral-950 dark:text-white">
            {thisMonthCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Next 30 Days</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-neutral-950 dark:text-white">
            {next30DaysCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Upcoming Milestones</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-neutral-950 dark:text-white">
            {upcomingMilestones.length}
            <span className="ml-2 font-sans text-xs font-normal text-neutral-500 dark:text-neutral-400">
              ({formattedSize})
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
};
