import type {BirthdayEntry, ComputedBirthday} from '../types/birthday';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(month: number, year?: number | null): number {
  if (month === 2) {
    if (year && !isLeapYear(year)) return 28;
    return 29;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function getSafeDayForYear(month: number, day: number, year: number): number {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return 28;
  }
  return Math.min(day, getDaysInMonth(month, year));
}

export function computeBirthday(entry: BirthdayEntry, referenceNow = new Date()): ComputedBirthday {
  const todayMidnight = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  );

  let targetYear = todayMidnight.getFullYear();
  let safeDay = getSafeDayForYear(entry.month, entry.day, targetYear);
  let nextDate = new Date(targetYear, entry.month - 1, safeDay);

  if (nextDate.getTime() < todayMidnight.getTime()) {
    targetYear += 1;
    safeDay = getSafeDayForYear(entry.month, entry.day, targetYear);
    nextDate = new Date(targetYear, entry.month - 1, safeDay);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.round((nextDate.getTime() - todayMidnight.getTime()) / msPerDay);

  const turningAge =
    entry.birthYear !== null && entry.birthYear > 1800 && entry.birthYear <= targetYear
      ? targetYear - entry.birthYear
      : null;

  const isToday = daysUntil === 0;
  const isThisWeek = daysUntil >= 0 && daysUntil <= 7;
  const isThisMonth =
    nextDate.getMonth() === todayMidnight.getMonth() &&
    nextDate.getFullYear() === todayMidnight.getFullYear();

  const isCelebratedThisYear = entry.celebratedYears.includes(targetYear);

  return {
    ...entry,
    daysUntil,
    nextDate,
    nextOccurrenceYear: targetYear,
    turningAge,
    isToday,
    isThisWeek,
    isThisMonth,
    isCelebratedThisYear,
  };
}

export function formatShortDate(month: number, day: number): string {
  return `${SHORT_MONTH_NAMES[month - 1]} ${day}`;
}

export function formatCountdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export function formatCompactCountdown(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return '1d';
  return `${daysUntil}d`;
}

export function formatTodayHeader(now = new Date()): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const MILESTONE_AGE_SET = new Set([
  1, 10, 13, 16, 18, 20, 21, 25, 30, 40, 50, 60, 65, 70, 75, 80, 90, 100,
]);

export function isMilestoneAge(age: number | null): age is number {
  if (age === null || age <= 0) return false;
  if (MILESTONE_AGE_SET.has(age)) return true;
  return age >= 100 && age % 5 === 0;
}

export function formatOrdinalAge(age: number): string {
  const mod100 = age % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${age}th`;
  switch (age % 10) {
    case 1:
      return `${age}st`;
    case 2:
      return `${age}nd`;
    case 3:
      return `${age}rd`;
    default:
      return `${age}th`;
  }
}

export function generateICSContent(entries: BirthdayEntry[]): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Linden Offline Birthday Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const entry of entries) {
    const refYear = entry.birthYear ?? new Date().getFullYear();
    const mm = String(entry.month).padStart(2, '0');
    const dd = String(getSafeDayForYear(entry.month, entry.day, refYear)).padStart(2, '0');
    const dtStart = `${refYear}${mm}${dd}`;
    const summary = `${entry.name}'s Birthday`.replace(/[,;\\]/g, '\\$&');
    const descriptionParts = [`Group: ${entry.group}`];
    if (entry.note.trim()) {
      descriptionParts.push(`Note: ${entry.note.trim()}`);
    }
    const description = descriptionParts.join(' — ').replace(/[,;\\]/g, '\\$&');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:linden-${entry.id}@local`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push('RRULE:FREQ=YEARLY');
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    if (entry.advanceDays > 0) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Upcoming birthday for ${summary}`);
      lines.push(`TRIGGER:-P${entry.advanceDays}D`);
      lines.push('END:VALARM');
    } else {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Birthday today for ${summary}`);
      lines.push('TRIGGER:PT9H');
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
