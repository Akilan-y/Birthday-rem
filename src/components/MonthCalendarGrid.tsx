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
              className={`rounded-2xl border p-5 transition-colors ${
                isCurrent
                  ? 'border-[#38BDF8]/50 bg-[#1D8FE1]/10'
                  : 'border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.07]">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {monthName}
                  </h3>
                  {isCurrent && (
                    <span className="text-xs font-medium text-[#1D8FE1] dark:text-[#38BDF8]">
                      Current
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAddForMonth(monthNum)}
                  aria-label={`Add birthday in ${monthName}`}
                  className="min-h-[36px] min-w-[36px] rounded-full inline-flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.1] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {items.length === 0 ? (
                <p className="py-5 text-xs text-slate-400 dark:text-slate-500">
                  No birthdays recorded
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                  {items.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="w-full py-2.5 min-h-[42px] flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-white/[0.05] -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <div className="flex items-baseline gap-3 min-w-0">
                          <span className="font-mono text-xs tabular-nums text-slate-400 w-5 shrink-0">
                            {String(entry.day).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {entry.name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
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
