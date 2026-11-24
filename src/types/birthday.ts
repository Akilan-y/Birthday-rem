export type RelationshipGroup = 'Family' | 'Friends' | 'Remembrance';

export type UpcomingFilter = 'All' | 'Within 30 Days' | RelationshipGroup;

export type AdvanceNoticeDays = 0 | 1 | 3 | 7;

export type WorkspaceView =
  | 'calendar'
  | 'upcoming'
  | 'gallery'
  | 'statistics'
  | 'assistant'
  | 'reminders'
  | 'sheets'
  | 'vault';

export type SortMode = 'soonest' | 'alphabetical' | 'month';

export type AssistantPersona = 'eco-gifting' | 'milestone-planner' | 'quick-wishes';

export interface PersonPhotoItem {
  id: string;
  driveFileId?: string;
  name: string;
  mimeType: string;
  caption?: string;
  createdAt: string;
  localDataUrl?: string;
}

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
  phone?: string;
  email?: string;
  relation?: string;
  favoriteThings?: string;
  avatarFileId?: string | null;
  avatarThumb?: string | null;
  galleryPhotos?: PersonPhotoItem[];
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
