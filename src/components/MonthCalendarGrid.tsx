import React from 'react';
import {Plus} from 'lucide-react';
import type {ComputedBirthday} from '../types/birthday';
import {MONTH_NAMES} from '../utils/dateMath';

interface MonthCalendarGridProps {
  birthdays: ComputedBirthday[];
  onEdit: (entry: ComputedBirthday) => void;
  onAddForMonth: (month: number) => void;
}

export const MonthCalendarGrid: React.FC<MonthCalendarGridProps> = ({
  birthdays,
  onEdit,
  onAddForMonth,
}) => {
  const currentMonth = new Date().getMonth() + 1;

  return (
    <section aria-label="Annual birthday calendar">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTH_NAMES.map((monthName, idx) => {
          const monthNum = idx + 1;
          const isCurrent = monthNum === currentMonth;
          const items = birthdays
            .filter((b) => b.month === monthNum)
            .sort((a, b) => a.day - b.day);

          return (
            <div
              key={monthName}
              className={`rounded-xl border p-5 transition-colors ${
                isCurrent
                  ? 'border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-900'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-base font-medium text-neutral-950 dark:text-white">
                    {monthName}
                  </h3>
                  {isCurrent && (
                    <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-neutral-950 dark:text-white">
                      Now
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAddForMonth(monthNum)}
                  aria-label={`Add birthday in ${monthName}`}
                  className="min-h-[32px] min-w-[32px] rounded-md inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {items.length === 0 ? (
                <p className="py-5 text-xs text-neutral-400 dark:text-neutral-600">
                  No birthdays recorded
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                  {items.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="w-full py-2.5 min-h-[40px] flex items-center justify-between gap-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900 -mx-2 px-2 rounded-md transition-colors cursor-pointer"
                      >
                        <div className="flex items-baseline gap-3 min-w-0">
                          <span className="font-mono text-xs tabular-nums text-neutral-400 dark:text-neutral-500 w-5 shrink-0">
                            {String(entry.day).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-medium text-neutral-950 dark:text-white truncate">
                            {entry.name}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0 tabular-nums">
                          {entry.turningAge !== null ? `Age ${entry.turningAge}` : entry.group}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
