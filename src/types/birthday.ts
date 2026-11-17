export type RelationshipGroup = 'Family' | 'Friends' | 'Colleagues' | 'Community';

export type AdvanceNoticeDays = 0 | 1 | 3 | 7;

export type WorkspaceView =
  | 'calendar'
  | 'upcoming'
  | 'statistics'
  | 'assistant'
  | 'reminders'
  | 'vault';

export type SortMode = 'soonest' | 'alphabetical' | 'month';

export type AssistantPersona = 'eco-gifting' | 'milestone-planner' | 'quick-wishes';

export interface ChatMessageEntry {
  id: string;
  role: 'user' | 'model';
  text: string;
  persona: AssistantPersona;
  model: string;
  createdAt: string;
}

export interface BirthdayEntry {
  id: string;
  name: string;
  month: number; // 1-12
  day: number; // 1-31
  birthYear: number | null;
  group: RelationshipGroup;
  note: string;
  advanceDays: AdvanceNoticeDays;
  celebratedYears: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ComputedBirthday extends BirthdayEntry {
  daysUntil: number;
  nextDate: Date;
  nextOccurrenceYear: number;
  turningAge: number | null;
  isToday: boolean;
  isThisWeek: boolean;
  isThisMonth: boolean;
  isCelebratedThisYear: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  dailyHour: string; // "09:00"
  defaultAdvanceDays: AdvanceNoticeDays;
  notifiedKeys: string[];
}

export interface NotificationLogItem {
  id: string;
  entryId: string;
  personName: string;
  message: string;
  triggeredAt: string;
}

export interface BackupPayload {
  app: 'Broll' | 'Linden';
  schemaVersion: 1;
  exportedAt: string;
  birthdays: BirthdayEntry[];
  settings: NotificationSettings;
}
