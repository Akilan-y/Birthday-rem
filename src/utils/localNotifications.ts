import type {
  ComputedBirthday,
  NotificationLogItem,
  NotificationSettings,
} from '../types/birthday';
import {formatCountdownLabel, formatShortDate} from './dateMath';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestLocalNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result;
}

export async function dispatchLocalNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: tag ?? `linden-${Date.now()}`,
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
    return true;
  } catch {
    return false;
  }
}

export function isPastPreferredHour(dailyHour: string, now = new Date()): boolean {
  const [hStr, mStr] = dailyHour.split(':');
  const targetH = Number(hStr ?? 9);
  const targetM = Number(mStr ?? 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetH * 60 + targetM;
  return nowMinutes >= targetMinutes;
}

export async function evaluateAndSendDueReminders(
  computedBirthdays: ComputedBirthday[],
  settings: NotificationSettings,
  now = new Date()
): Promise<{
  newNotifiedKeys: string[];
  newLogs: NotificationLogItem[];
}> {
  if (!settings.enabled || getNotificationPermissionState() !== 'granted') {
    return {newNotifiedKeys: [], newLogs: []};
  }

  if (!isPastPreferredHour(settings.dailyHour, now)) {
    return {newNotifiedKeys: [], newLogs: []};
  }

  const notifiedSet = new Set(settings.notifiedKeys);
  const newNotifiedKeys: string[] = [];
  const newLogs: NotificationLogItem[] = [];

  for (const entry of computedBirthdays) {
    if (entry.isCelebratedThisYear) continue;

    // Trigger either on the configured advance day OR on the birthday itself (daysUntil === 0)
    const shouldNotifyForAdvance = entry.daysUntil === entry.advanceDays;
    const shouldNotifyOnDay = entry.daysUntil === 0;

    if (!shouldNotifyForAdvance && !shouldNotifyOnDay) {
      continue;
    }

    const triggerKey = `${entry.id}-${entry.nextOccurrenceYear}-d${entry.daysUntil}`;
    if (notifiedSet.has(triggerKey)) {
      continue;
    }

    const dateLabel = formatShortDate(entry.month, entry.day);
    const whenLabel = formatCountdownLabel(entry.daysUntil);
    const isRemembrance = entry.group === 'Remembrance';
    const ageLabel =
      entry.turningAge !== null
        ? isRemembrance
          ? ` (${entry.turningAge} yrs)`
          : ` (Turning ${entry.turningAge})`
        : '';
    const title = isRemembrance
      ? entry.daysUntil === 0
        ? `Remembrance Day: ${entry.name}`
        : `Upcoming Remembrance: ${entry.name}`
      : entry.daysUntil === 0
      ? `Birthday Today: ${entry.name}`
      : `Upcoming Birthday: ${entry.name}`;
    const body = `${whenLabel} · ${dateLabel}${ageLabel}${entry.note ? ` — ${entry.note}` : ''}`;

    const sent = await dispatchLocalNotification(title, body, triggerKey);
    if (sent) {
      notifiedSet.add(triggerKey);
      newNotifiedKeys.push(triggerKey);
      newLogs.push({
        id: crypto.randomUUID(),
        entryId: entry.id,
        personName: entry.name,
        message: `${whenLabel} · ${dateLabel}${ageLabel}`,
        triggeredAt: now.toISOString(),
      });
    }
  }

  return {newNotifiedKeys, newLogs};
}
