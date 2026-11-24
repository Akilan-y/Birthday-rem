import type {
  AdvanceNoticeDays,
  BackupPayload,
  BirthdayEntry,
  ChatMessageEntry,
  NotificationLogItem,
  NotificationSettings,
  RelationshipGroup,
} from '../types/birthday';

const DB_NAME = 'linden_offline_vault';
const DB_VERSION = 1;
const STORE_BIRTHDAYS = 'birthdays';
const STORE_META = 'meta';

const LS_BIRTHDAYS_KEY = 'linden_birthdays_v1';
const LS_SETTINGS_KEY = 'linden_settings_v1';
const LS_LOGS_KEY = 'linden_notification_logs_v1';
const LS_CHAT_KEY = 'broll_chat_messages_v1';
const LS_INITIALIZED_KEY = 'linden_initialized_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  dailyHour: '09:00',
  defaultAdvanceDays: 1,
  notifiedKeys: [],
};

const SAMPLE_BIRTHDAY_IDS = new Set([
  'seed-maya',
  'seed-arthur',
  'seed-nadia',
  'seed-soren',
]);

export function isSampleBirthdayId(id: string): boolean {
  return SAMPLE_BIRTHDAY_IDS.has(id) || id.startsWith('seed-');
}

export function normalizeRelationshipGroup(raw: unknown): RelationshipGroup {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized === 'family') return 'Family';
  if (
    normalized === 'remembrance' ||
    normalized === 'rememberence' ||
    normalized === 'remember' ||
    normalized === 'memorial' ||
    normalized === 'death' ||
    normalized === 'in memory'
  ) {
    return 'Remembrance';
  }
  return 'Friends';
}

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BIRTHDAYS)) {
        db.createObjectStore(STORE_BIRTHDAYS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, {keyPath: 'key'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadVaultData(): Promise<{
  birthdays: BirthdayEntry[];
  settings: NotificationSettings;
  logs: NotificationLogItem[];
}> {
  const alreadyInitialized = localStorage.getItem(LS_INITIALIZED_KEY) === 'true';

  try {
    const db = await openVaultDB();
    const tx = db.transaction([STORE_BIRTHDAYS, STORE_META], 'readonly');
    const birthdaysStore = tx.objectStore(STORE_BIRTHDAYS);
    const metaStore = tx.objectStore(STORE_META);

    const birthdays = await new Promise<BirthdayEntry[]>((resolve, reject) => {
      const req = birthdaysStore.getAll();
      req.onsuccess = () => resolve((req.result as BirthdayEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    const settingsRecord = await new Promise<{key: string; value: NotificationSettings} | undefined>(
      (resolve, reject) => {
        const req = metaStore.get('settings');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );

    const logsRecord = await new Promise<{key: string; value: NotificationLogItem[]} | undefined>(
      (resolve, reject) => {
        const req = metaStore.get('logs');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );

    db.close();

    if (!alreadyInitialized) {
      localStorage.setItem(LS_INITIALIZED_KEY, 'true');
      await saveSettingsToVault(settingsRecord?.value ?? DEFAULT_NOTIFICATION_SETTINGS);
    }

    let migratedGroup = false;
    const cleanedBirthdays = birthdays
      .filter((item) => !isSampleBirthdayId(item.id))
      .map((item) => {
        const normalizedGroup = normalizeRelationshipGroup(item.group);
        if (normalizedGroup !== item.group) {
          migratedGroup = true;
          return {...item, group: normalizedGroup};
        }
        return item;
      });
    if (cleanedBirthdays.length !== birthdays.length || migratedGroup) {
      await saveBirthdaysToVault(cleanedBirthdays);
    }

    return {
      birthdays: cleanedBirthdays,
      settings: settingsRecord?.value ?? DEFAULT_NOTIFICATION_SETTINGS,
      logs: logsRecord?.value ?? [],
    };
  } catch {
    // Fallback cleanly to localStorage if IndexedDB is restricted
    if (!alreadyInitialized) {
      localStorage.setItem(LS_INITIALIZED_KEY, 'true');
      localStorage.setItem(LS_BIRTHDAYS_KEY, JSON.stringify([]));
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
      return {
        birthdays: [],
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        logs: [],
      };
    }

    const rawBirthdays = localStorage.getItem(LS_BIRTHDAYS_KEY);
    const rawSettings = localStorage.getItem(LS_SETTINGS_KEY);
    const rawLogs = localStorage.getItem(LS_LOGS_KEY);

    const parsedBirthdays = rawBirthdays ? (JSON.parse(rawBirthdays) as BirthdayEntry[]) : [];
    let migratedGroup = false;
    const cleanedBirthdays = parsedBirthdays
      .filter((item) => !isSampleBirthdayId(item.id))
      .map((item) => {
        const normalizedGroup = normalizeRelationshipGroup(item.group);
        if (normalizedGroup !== item.group) {
          migratedGroup = true;
          return {...item, group: normalizedGroup};
        }
        return item;
      });
    if (cleanedBirthdays.length !== parsedBirthdays.length || migratedGroup) {
      localStorage.setItem(LS_BIRTHDAYS_KEY, JSON.stringify(cleanedBirthdays));
    }

    return {
      birthdays: cleanedBirthdays,
      settings: rawSettings
        ? (JSON.parse(rawSettings) as NotificationSettings)
        : DEFAULT_NOTIFICATION_SETTINGS,
      logs: rawLogs ? (JSON.parse(rawLogs) as NotificationLogItem[]) : [],
    };
  }
}

export async function saveBirthdaysToVault(birthdays: BirthdayEntry[]): Promise<void> {
  localStorage.setItem(LS_INITIALIZED_KEY, 'true');
  localStorage.setItem(LS_BIRTHDAYS_KEY, JSON.stringify(birthdays));

  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_BIRTHDAYS, 'readwrite');
    const store = tx.objectStore(STORE_BIRTHDAYS);
    store.clear();
    for (const item of birthdays) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // localStorage mirror already written
  }
}

export async function saveSettingsToVault(settings: NotificationSettings): Promise<void> {
  localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));

  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({key: 'settings', value: settings});
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // localStorage mirror already written
  }
}

export async function saveLogsToVault(logs: NotificationLogItem[]): Promise<void> {
  const trimmed = logs.slice(0, 40);
  localStorage.setItem(LS_LOGS_KEY, JSON.stringify(trimmed));

  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({key: 'logs', value: trimmed});
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // localStorage mirror already written
  }
}

export async function loadChatMessagesFromVault(): Promise<ChatMessageEntry[]> {
  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_META, 'readonly');
    const record = await new Promise<{key: string; value: ChatMessageEntry[]} | undefined>(
      (resolve, reject) => {
        const req = tx.objectStore(STORE_META).get('chatMessages');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    if (record?.value && Array.isArray(record.value)) {
      return record.value;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const raw = localStorage.getItem(LS_CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessageEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveChatMessagesToVault(
  messages: ChatMessageEntry[]
): Promise<void> {
  const trimmed = messages.slice(-60);
  localStorage.setItem(LS_CHAT_KEY, JSON.stringify(trimmed));

  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({key: 'chatMessages', value: trimmed});
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // localStorage mirror already written
  }
}

export function calculateVaultBytes(
  birthdays: BirthdayEntry[],
  settings: NotificationSettings,
  logs: NotificationLogItem[]
): number {
  const serialized = JSON.stringify({birthdays, settings, logs});
  return new Blob([serialized]).size;
}

export function buildBackupPayload(
  birthdays: BirthdayEntry[],
  settings: NotificationSettings
): BackupPayload {
  return {
    app: 'Broll',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    birthdays,
    settings,
  };
}

export function parseImportedBackup(rawJson: string): {
  birthdays: BirthdayEntry[];
  settings?: NotificationSettings;
} {
  const parsed = JSON.parse(rawJson) as Partial<BackupPayload>;
  if (!parsed || !Array.isArray(parsed.birthdays)) {
    throw new Error('Invalid backup format: expected a birthdays array.');
  }

  const validAdvance = new Set([0, 1, 3, 7]);
  const nowIso = new Date().toISOString();

  const sanitized: BirthdayEntry[] = parsed.birthdays
    .filter((item): item is BirthdayEntry => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.month === 'number' &&
        item.month >= 1 &&
        item.month <= 12 &&
        typeof item.day === 'number' &&
        item.day >= 1 &&
        item.day <= 31
      );
    })
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      name: item.name.trim().slice(0, 80),
      month: Math.trunc(item.month),
      day: Math.trunc(item.day),
      birthYear:
        typeof item.birthYear === 'number' && item.birthYear >= 1900 && item.birthYear <= 2100
          ? Math.trunc(item.birthYear)
          : null,
      group: normalizeRelationshipGroup(item.group),
      note: typeof item.note === 'string' ? item.note.slice(0, 280) : '',
      advanceDays: validAdvance.has(item.advanceDays) ? item.advanceDays : 1,
      celebratedYears: Array.isArray(item.celebratedYears)
        ? item.celebratedYears.filter((y): y is number => typeof y === 'number')
        : [],
      phone: typeof item.phone === 'string' ? item.phone.trim().slice(0, 40) : undefined,
      email: typeof item.email === 'string' ? item.email.trim().slice(0, 160) : undefined,
      relation: typeof item.relation === 'string' ? item.relation.trim().slice(0, 60) : undefined,
      favoriteThings:
        typeof item.favoriteThings === 'string'
          ? item.favoriteThings.trim().slice(0, 280)
          : undefined,
      avatarFileId: typeof item.avatarFileId === 'string' ? item.avatarFileId : null,
      avatarThumb: typeof item.avatarThumb === 'string' ? item.avatarThumb : null,
      galleryPhotos: Array.isArray(item.galleryPhotos)
        ? item.galleryPhotos.filter(
            (p) =>
              p &&
              typeof p === 'object' &&
              typeof p.id === 'string' &&
              typeof p.name === 'string'
          )
        : undefined,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowIso,
      updatedAt: nowIso,
    }));

  return {
    birthdays: sanitized,
    settings: parsed.settings,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface SheetIncompleteRow {
  id: string;
  name: string;
  event: string;
  group: RelationshipGroup;
  advanceDays: AdvanceNoticeDays;
  note: string;
}

export interface ParsedTableResult {
  entries: BirthdayEntry[];
  incompleteRows: SheetIncompleteRow[];
  isEventsSchema: boolean;
  missingExtraColumns: string[];
  headers: string[];
}

export function formatReminderLabel(days: AdvanceNoticeDays): string {
  if (days === 0) return 'On day';
  if (days === 1) return '1 day prior';
  return `${days} days prior`;
}

export function parseReminderDays(raw: string): AdvanceNoticeDays {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return 1;
  if (normalized === '0' || normalized.includes('on day') || normalized.includes('same day') || normalized === '0d') {
    return 0;
  }
  const numMatch = /(\d+)/.exec(normalized);
  if (numMatch) {
    const val = Number.parseInt(numMatch[1], 10);
    if (val === 0) return 0;
    if (val === 1) return 1;
    if (val === 3) return 3;
    if (val === 7) return 7;
    if (val > 5) return 7;
    if (val >= 2) return 3;
  }
  return 1;
}

export function formatBirthdaySheetDate(month: number, day: number, birthYear: number | null): string {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return birthYear ? `${dd}/${mm}/${birthYear}` : `${dd}/${mm}`;
}

export function buildBirthdayTableRows(
  birthdays: BirthdayEntry[],
  incompleteRows: SheetIncompleteRow[] = []
): string[][] {
  const headers = [
    'Sl. No.',
    'Names',
    'Date',
    'Event',
    'Circle',
    'Reminder',
    'Note',
    'Broll ID',
  ];

  const rows: string[][] = birthdays.map((entry, idx) => [
    String(idx + 1),
    entry.name,
    formatBirthdaySheetDate(entry.month, entry.day, entry.birthYear),
    entry.group === 'Remembrance' ? 'Remembrance' : 'Birthday',
    entry.group,
    formatReminderLabel(entry.advanceDays),
    entry.note,
    entry.id,
  ]);

  incompleteRows.forEach((row, idx) => {
    rows.push([
      String(birthdays.length + idx + 1),
      row.name,
      '',
      row.event || 'Birthday',
      row.group,
      formatReminderLabel(row.advanceDays),
      row.note,
      row.id,
    ]);
  });

  return [headers, ...rows];
}

export function buildCSVExport(birthdays: BirthdayEntry[]): string {
  return buildBirthdayTableRows(birthdays)
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
}

export function parseCsvRows(rawCsv: string): string[][] {
  const input = rawCsv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (input[i + 1] === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function normalizeHeaderKey(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_.-]+/g, '');
}

function inferColumnDayFirst(
  rows: string[][],
  dateIdx: number,
  isEventsSchema: boolean
): boolean {
  if (dateIdx === -1) return true;
  let sawDotSeparator = false;
  for (let r = 1; r < rows.length; r++) {
    const raw = (rows[r][dateIdx] ?? '').trim();
    if (!raw) continue;
    if (/^\d{4}[-/.]/.test(raw)) continue;
    const match = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/.exec(raw);
    if (!match) continue;
    if (raw.includes('.')) sawDotSeparator = true;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second >= 1 && second <= 12) return true;
    if (second > 12 && first >= 1 && first <= 12) return false;
  }
  return sawDotSeparator || isEventsSchema;
}

function parseFlexibleDateString(
  raw: string,
  preferDayFirst = true
): {
  month: number;
  day: number;
  birthYear: number | null;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthYear: year >= 1900 && year <= 2100 ? year : null,
      };
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.M.YYYY or MM/DD/YYYY
  const dmyOrMdyYearMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (dmyOrMdyYearMatch) {
    const first = Number(dmyOrMdyYearMatch[1]);
    const second = Number(dmyOrMdyYearMatch[2]);
    const year = Number(dmyOrMdyYearMatch[3]);
    let dayFirst = preferDayFirst || trimmed.includes('.');
    if (first > 12 && second <= 12) dayFirst = true;
    else if (second > 12 && first <= 12) dayFirst = false;

    const day = dayFirst ? first : second;
    const month = dayFirst ? second : first;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthYear: year >= 1900 && year <= 2100 ? year : null,
      };
    }
  }

  // DD/MM or MM/DD (no year)
  const mdMatch = /^(\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
  if (mdMatch) {
    const first = Number(mdMatch[1]);
    const second = Number(mdMatch[2]);
    let dayFirst = preferDayFirst || trimmed.includes('.');
    if (first > 12 && second <= 12) dayFirst = true;
    else if (second > 12 && first <= 12) dayFirst = false;

    const day = dayFirst ? first : second;
    const month = dayFirst ? second : first;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {month, day, birthYear: null};
    }
  }

  return null;
}

export function parseTableRowsToBirthdaysDetailed(rawRows: string[][]): ParsedTableResult {
  const rows = rawRows.filter((r) => r.some((c) => String(c ?? '').trim().length > 0));
  if (rows.length < 1) {
    throw new Error('Spreadsheet must include a header row.');
  }

  const headers = rows[0].map((h) => String(h ?? '').trim());
  const headerMap = new Map<string, number>();
  headers.forEach((header, idx) => {
    headerMap.set(normalizeHeaderKey(header), idx);
  });

  const colIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headerMap.get(alias);
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const nameIdx = colIndex('name', 'names', 'fullname', 'person');
  const monthIdx = colIndex('month');
  const dayIdx = colIndex('day');
  const dateIdx = colIndex('date', 'birthday', 'birthdate', 'dob');

  if (nameIdx === -1 || ((monthIdx === -1 || dayIdx === -1) && dateIdx === -1)) {
    throw new Error(
      'Invalid columns: expected "Names" (or "Name") along with "Date" (or "Month" & "Day").'
    );
  }

  const idIdx = colIndex('brollid', 'id');
  const yearIdx = colIndex('birthyear', 'year');
  const groupIdx = colIndex('circle', 'group', 'relationship');
  const advanceIdx = colIndex('reminder', 'advancedays', 'noticedays', 'reminderdays');
  const noteIdx = colIndex('note', 'notes', 'memo');
  const eventIdx = colIndex('event');
  const slNoIdx = colIndex('slno', 'serialno', 'sno');
  const celebratedIdx = colIndex('celebratedyears');

  const isEventsSchema = slNoIdx !== -1 || eventIdx !== -1 || headerMap.has('names');
  const missingExtraColumns: string[] = [];
  if (groupIdx === -1) missingExtraColumns.push('Circle');
  if (advanceIdx === -1) missingExtraColumns.push('Reminder');
  if (noteIdx === -1) missingExtraColumns.push('Note');
  if (idIdx === -1) missingExtraColumns.push('Broll ID');

  const preferDayFirst = inferColumnDayFirst(rows, dateIdx, isEventsSchema);

  const nowIso = new Date().toISOString();

  const entries: BirthdayEntry[] = [];
  const incompleteRows: SheetIncompleteRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[nameIdx] ?? '').trim().slice(0, 80);
    if (!name) continue;

    const rawGroup = groupIdx !== -1 ? (cells[groupIdx] ?? '').trim() : '';
    const rawEvent = eventIdx !== -1 ? (cells[eventIdx] ?? '').trim() : '';
    const group: RelationshipGroup = rawGroup
      ? normalizeRelationshipGroup(rawGroup)
      : normalizeRelationshipGroup(rawEvent) === 'Remembrance'
      ? 'Remembrance'
      : 'Friends';
    const advanceDays: AdvanceNoticeDays =
      advanceIdx !== -1 ? parseReminderDays(cells[advanceIdx] ?? '') : 1;
    const note = noteIdx !== -1 ? (cells[noteIdx] ?? '').trim().slice(0, 280) : '';
    const rawId = idIdx !== -1 ? (cells[idIdx] ?? '').trim() : '';
    const eventLabel = rawEvent || (group === 'Remembrance' ? 'Remembrance' : 'Birthday');

    let month = monthIdx !== -1 ? Number.parseInt((cells[monthIdx] ?? '').trim(), 10) : NaN;
    let day = dayIdx !== -1 ? Number.parseInt((cells[dayIdx] ?? '').trim(), 10) : NaN;
    let birthYear: number | null = null;

    if (yearIdx !== -1) {
      const yr = Number.parseInt((cells[yearIdx] ?? '').trim(), 10);
      if (Number.isInteger(yr) && yr >= 1900 && yr <= 2100) {
        birthYear = yr;
      }
    }

    if ((Number.isNaN(month) || Number.isNaN(day)) && dateIdx !== -1) {
      const parsedDate = parseFlexibleDateString(cells[dateIdx] ?? '', preferDayFirst);
      if (parsedDate) {
        month = parsedDate.month;
        day = parsedDate.day;
        if (birthYear === null) {
          birthYear = parsedDate.birthYear;
        }
      }
    }

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      incompleteRows.push({
        id: rawId || `pending-${r}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name,
        event: eventLabel,
        group,
        advanceDays,
        note,
      });
      continue;
    }

    const celebratedYears =
      celebratedIdx !== -1
        ? (cells[celebratedIdx] ?? '')
            .split(/[;|]/)
            .map((v) => Number.parseInt(v.trim(), 10))
            .filter((y) => Number.isInteger(y) && y >= 1900 && y <= 2200)
        : [];

    entries.push({
      id: rawId || crypto.randomUUID(),
      name,
      month,
      day,
      birthYear,
      group,
      note,
      advanceDays,
      celebratedYears,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return {
    entries,
    incompleteRows,
    isEventsSchema,
    missingExtraColumns,
    headers,
  };
}

export function parseTableRowsToBirthdays(rawRows: string[][]): BirthdayEntry[] {
  const result = parseTableRowsToBirthdaysDetailed(rawRows);
  if (result.entries.length === 0) {
    throw new Error('No valid birthday rows found.');
  }
  return result.entries;
}

export function parseImportedCSV(rawCsv: string): BirthdayEntry[] {
  return parseTableRowsToBirthdays(parseCsvRows(rawCsv));
}

export function parseBackupFile(
  filename: string,
  content: string
): {
  format: 'csv' | 'json';
  birthdays: BirthdayEntry[];
  settings?: NotificationSettings;
} {
  const trimmed = content.trim();
  const isCsvExtension = filename.toLowerCase().endsWith('.csv');

  if (isCsvExtension || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return {
      format: 'csv',
      birthdays: parseImportedCSV(content),
    };
  }

  const jsonResult = parseImportedBackup(content);
  return {
    format: 'json',
    birthdays: jsonResult.birthdays,
    settings: jsonResult.settings,
  };
}
