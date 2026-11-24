import React, {useState} from 'react';
import {Bell, BellOff, CheckCircle2, Send} from 'lucide-react';
import type {
  AdvanceNoticeDays,
  ComputedBirthday,
  NotificationLogItem,
  NotificationSettings,
} from '../types/birthday';
import {formatShortDate} from '../utils/dateMath';
import {
  dispatchLocalNotification,
  getNotificationPermissionState,
  requestLocalNotificationPermission,
  type NotificationPermissionState,
} from '../utils/localNotifications';

interface RemindersPanelProps {
  settings: NotificationSettings;
  onUpdateSettings: (next: NotificationSettings) => void;
  birthdays: ComputedBirthday[];
  logs: NotificationLogItem[];
  onAppendLog: (log: NotificationLogItem) => void;
  onClearLogs: () => void;
}

const ADVANCE_OPTIONS: {value: AdvanceNoticeDays; label: string}[] = [
  {value: 0, label: 'On the birthday'},
  {value: 1, label: '1 day before'},
  {value: 3, label: '3 days before'},
  {value: 7, label: '7 days before'},
];

export const RemindersPanel: React.FC<RemindersPanelProps> = ({
  settings,
  onUpdateSettings,
  birthdays,
  logs,
  onAppendLog,
  onClearLogs,
}) => {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionState()
  );
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const handleEnableNotifications = async () => {
    const result = await requestLocalNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      onUpdateSettings({...settings, enabled: true});
      setTestFeedback('Local device notifications are active.');
    } else if (result === 'denied') {
      onUpdateSettings({...settings, enabled: false});
      setTestFeedback(
        'Browser notifications are blocked for this site. Enable them in your browser site settings.'
      );
    } else if (result === 'unsupported') {
      setTestFeedback('This browser context does not support desktop notifications.');
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings.enabled) {
      if (permission !== 'granted') {
        await handleEnableNotifications();
        return;
      }
      onUpdateSettings({...settings, enabled: true});
    } else {
      onUpdateSettings({...settings, enabled: false});
    }
  };

  const handleSendTest = async () => {
    if (permission !== 'granted') {
      const result = await requestLocalNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        setTestFeedback('Allow notifications first to run a local test alert.');
        return;
      }
    }

    const ok = await dispatchLocalNotification(
      'Broll Local Reminder Test',
      'Your device will show birthday reminders locally with zero server involvement.',
      `broll-test-${Date.now()}`
    );

    if (ok) {
      onAppendLog({
        id: crypto.randomUUID(),
        entryId: 'test',
        personName: 'Local Test Alert',
        message: 'Verified on-device notification delivery.',
        triggeredAt: new Date().toISOString(),
      });
      setTestFeedback('Test notification sent directly from your browser.');
    } else {
      setTestFeedback(
        'Unable to display a system notification in this window. In-app reminders remain active.'
      );
    }
  };

  const upcomingSchedule = birthdays.filter((b) => b.daysUntil <= 30).slice(0, 8);

  const permissionLabel =
    permission === 'granted'
      ? 'Granted'
      : permission === 'denied'
      ? 'Blocked by browser'
      : permission === 'unsupported'
      ? 'Unavailable in this context'
      : 'Not yet requested';

  return (
    <section aria-label="Local notifications" className="space-y-6">
      <div className="pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="font-display text-2xl font-medium text-neutral-950 dark:text-white">
          Local Notifications
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
          Alerts are evaluated strictly on your device using the browser Notification API and local Service Worker. Nothing is sent to external push servers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
                  {settings.enabled && permission === 'granted' ? (
                    <Bell className="w-4 h-4 text-neutral-950 dark:text-white" />
                  ) : (
                    <BellOff className="w-4 h-4 text-neutral-400" />
                  )}
                  On-Device Birthday Alerts
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Browser permission:{' '}
                  <span className="font-medium text-neutral-950 dark:text-white">
                    {permissionLabel}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`px-4 py-2 min-h-[38px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.enabled && permission === 'granted'
                    ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-950 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    : 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200'
                }`}
              >
                {settings.enabled && permission === 'granted'
                  ? 'Pause Local Alerts'
                  : 'Enable Local Alerts'}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Preferred Alert Time
                </span>
                <input
                  type="time"
                  value={settings.dailyHour}
                  onChange={(e) =>
                    onUpdateSettings({...settings, dailyHour: e.target.value || '09:00'})
                  }
                  className="mt-2 w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm font-mono tabular-nums text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Default Lead Time (New Entries)
                </span>
                <select
                  value={settings.defaultAdvanceDays}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultAdvanceDays: Number(e.target.value) as AdvanceNoticeDays,
                    })
                  }
                  className="mt-2 w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
                >
                  {ADVANCE_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-white dark:bg-neutral-900"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 pt-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Check that your device allows local notifications from Broll.
              </p>
              <button
                type="button"
                onClick={handleSendTest}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-950 dark:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Send Test Notification
              </button>
            </div>

            {testFeedback && (
              <p className="mt-4 text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{testFeedback}</span>
              </p>
            )}
          </div>

          {/* Local Trigger Log */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                Recent Local Alerts
              </h3>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  Clear Log
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <p className="py-6 text-sm text-neutral-500 dark:text-neutral-400">
                No local notifications have fired yet on this device.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {logs.slice(0, 8).map((item) => (
                  <li key={item.id} className="py-3 flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-950 dark:text-white truncate">
                        {item.personName}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.message}</p>
                    </div>
                    <time className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                      {new Date(item.triggeredAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Upcoming Schedule Preview */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-white pb-3 border-b border-neutral-200 dark:border-neutral-800">
              Next 30 Days Schedule
            </h3>
            {upcomingSchedule.length === 0 ? (
              <p className="py-6 text-sm text-neutral-500 dark:text-neutral-400">
                No birthdays scheduled within the next 30 days.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {upcomingSchedule.map((item) => (
                  <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-950 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatShortDate(item.month, item.day)}
                        <span aria-hidden="true"> · </span>
                        {item.advanceDays === 0
                          ? `Alert on day at ${settings.dailyHour}`
                          : `Alert ${item.advanceDays}d before at ${settings.dailyHour}`}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-medium tabular-nums text-neutral-950 dark:text-white shrink-0">
                      {item.daysUntil === 0 ? 'Today' : `${item.daysUntil}d`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tip: Export an offline <span className="font-mono">.ics</span> file from the Vault to sync recurring yearly reminders into your native OS calendar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
