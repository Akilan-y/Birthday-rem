import React, {useMemo} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {ComputedBirthday, RelationshipGroup} from '../types/birthday';
import {MONTH_NAMES, SHORT_MONTH_NAMES} from '../utils/dateMath';

interface StatisticsSectionProps {
  birthdays: ComputedBirthday[];
  isDarkMode: boolean;
  onSelectGroup?: (group: 'All' | RelationshipGroup) => void;
}

interface MonthDatum {
  monthIndex: number;
  shortMonth: string;
  fullMonth: string;
  count: number;
  isCurrentMonth: boolean;
}

interface GroupDatum {
  group: RelationshipGroup;
  count: number;
  share: number;
}

const RELATIONSHIP_GROUPS: RelationshipGroup[] = [
  'Family',
  'Friends',
  'Remembrance',
];

export const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  birthdays,
  isDarkMode,
  onSelectGroup,
}) => {
  const currentMonthIndex = new Date().getMonth();

  const monthlyData = useMemo<MonthDatum[]>(() => {
    const counts = new Array<number>(12).fill(0);
    for (const b of birthdays) {
      if (b.month >= 1 && b.month <= 12) {
        counts[b.month - 1] += 1;
      }
    }
    return SHORT_MONTH_NAMES.map((shortMonth, idx) => ({
      monthIndex: idx,
      shortMonth,
      fullMonth: MONTH_NAMES[idx],
      count: counts[idx],
      isCurrentMonth: idx === currentMonthIndex,
    }));
  }, [birthdays, currentMonthIndex]);

  const groupData = useMemo<GroupDatum[]>(() => {
    const counts: Record<RelationshipGroup, number> = {
      Family: 0,
      Friends: 0,
      Remembrance: 0,
    };
    for (const b of birthdays) {
      if (b.group in counts) {
        counts[b.group] += 1;
      } else {
        counts.Friends += 1;
      }
    }
    const total = birthdays.length;
    return RELATIONSHIP_GROUPS.map((group) => ({
      group,
      count: counts[group],
      share: total > 0 ? Math.round((counts[group] / total) * 100) : 0,
    }));
  }, [birthdays]);

  const busiestMonth = useMemo(() => {
    if (birthdays.length === 0) return null;
    return monthlyData.reduce((best, curr) => (curr.count > best.count ? curr : best), monthlyData[0]);
  }, [birthdays.length, monthlyData]);

  const axisTextColor = isDarkMode ? '#A1A1AA' : '#52525B';
  const gridStrokeColor = isDarkMode ? '#27272A' : '#E4E4E7';
  const activeBarColor = isDarkMode ? '#FAFAFA' : '#09090B';
  const mutedBarColor = isDarkMode ? '#3F3F46' : '#D4D4D8';

  const groupColors: Record<RelationshipGroup, string> = isDarkMode
    ? {
        Family: '#FAFAFA',
        Friends: '#A1A1AA',
        Remembrance: '#52525B',
      }
    : {
        Family: '#09090B',
        Friends: '#52525B',
        Remembrance: '#A1A1AA',
      };

  return (
    <section aria-label="Birthday statistics">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4">
        <div>
          <h2 className="font-display text-xl font-medium text-neutral-950 dark:text-white">
            Statistics
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {busiestMonth && busiestMonth.count > 0
              ? `Peak month is ${busiestMonth.fullMonth} (${busiestMonth.count} ${
                  busiestMonth.count === 1 ? 'birthday' : 'birthdays'
                }) across ${birthdays.length} local ${
                  birthdays.length === 1 ? 'entry' : 'entries'
                }.`
              : 'Computed locally from your offline birthday vault.'}
          </p>
        </div>
      </div>

      {birthdays.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Add birthdays to view your monthly distribution and relationship circle breakdown.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Monthly Distribution Bar Chart */}
          <div className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Birthdays per Month
              </h3>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Current month highlighted
              </span>
            </div>

            <div className="w-full h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{top: 8, right: 8, left: -16, bottom: 0}}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke={gridStrokeColor}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="shortMonth"
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: axisTextColor, fontSize: 11}}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: axisTextColor, fontSize: 11}}
                    width={36}
                  />
                  <Tooltip
                    cursor={{
                      fill: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(9,9,11,0.04)',
                    }}
                    content={({active, payload}) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const datum = payload[0].payload as MonthDatum;
                      return (
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs shadow-sm">
                          <p className="font-medium text-neutral-950 dark:text-white">
                            {datum.fullMonth}
                          </p>
                          <p className="mt-0.5 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                            {datum.count} {datum.count === 1 ? 'birthday' : 'birthdays'}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {monthlyData.map((entry) => (
                      <Cell
                        key={entry.shortMonth}
                        fill={entry.isCurrentMonth ? activeBarColor : mutedBarColor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Relationship Group Breakdown */}
          <div className="lg:col-span-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                By Relationship Circle
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Count across personal circles
              </p>

              <div className="mt-4 w-full h-40 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groupData}
                    layout="vertical"
                    margin={{top: 0, right: 12, left: 4, bottom: 0}}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke={gridStrokeColor}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{fill: axisTextColor, fontSize: 11}}
                    />
                    <YAxis
                      type="category"
                      dataKey="group"
                      axisLine={false}
                      tickLine={false}
                      width={92}
                      tick={{fill: axisTextColor, fontSize: 12}}
                    />
                    <Tooltip
                      cursor={{
                        fill: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(9,9,11,0.04)',
                      }}
                      content={({active, payload}) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const datum = payload[0].payload as GroupDatum;
                        return (
                          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs shadow-sm">
                            <p className="font-medium text-neutral-950 dark:text-white">
                              {datum.group}
                            </p>
                            <p className="mt-0.5 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                              {datum.count} ({datum.share}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                      {groupData.map((entry) => (
                        <Cell
                          key={entry.group}
                          fill={groupColors[entry.group]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <dl className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200/70 dark:divide-neutral-800/80 text-xs">
              {groupData.map((item) => (
                <div
                  key={item.group}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <dt className="text-neutral-600 dark:text-neutral-300">
                    {onSelectGroup ? (
                      <button
                        type="button"
                        onClick={() => onSelectGroup(item.group)}
                        className="hover:text-neutral-950 dark:hover:text-white hover:underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        {item.group}
                      </button>
                    ) : (
                      item.group
                    )}
                  </dt>
                  <dd className="font-mono tabular-nums text-neutral-950 dark:text-white">
                    {item.count}{' '}
                    <span className="text-neutral-400 dark:text-neutral-500">({item.share}%)</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
};
