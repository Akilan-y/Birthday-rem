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

function createSeedBirthdays(now = new Date()): BirthdayEntry[] {
  const addDays = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {month: d.getMonth() + 1, day: d.getDate()};
  };

  const today = addDays(0);
  const inFourDays = addDays(4);
  const inTwelveDays = addDays(12);
  const inFortyFiveDays = addDays(45);
  const stamp = now.toISOString();

  return [
    {
      id: 'seed-maya',
      name: 'Maya Lin',
      month: today.month,
      day: today.day,
      birthYear: 1995,
      group: 'Friends',
      note: 'Prefers handwritten postcards and loose-leaf jasmine tea.',
      advanceDays: 0,
      celebratedYears: [],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'seed-arthur',
      name: 'Arthur Pendelton',
      month: inFourDays.month,
      day: inFourDays.day,
      birthYear: 1968,
      group: 'Family',
      note: 'Heirloom tomato seeds or a weekend walk at the conservatory.',
      advanceDays: 1,
      celebratedYears: [],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'seed-nadia',
      name: 'Nadia Okafor',
      month: inTwelveDays.month,
      day: inTwelveDays.day,
      birthYear: 1992,
      group: 'Colleagues',
      note: 'Send a quiet morning note before the team standup.',
      advanceDays: 3,
      celebratedYears: [],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'seed-soren',
      name: 'Soren Lindqvist',
      month: inFortyFiveDays.month,
      day: inFortyFiveDays.day,
      birthYear: null,
      group: 'Community',
      note: 'Community garden coordinator — loves sourdough and beeswax wraps.',
      advanceDays: 7,
      celebratedYears: [],
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
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

    if (!alreadyInitialized && birthdays.length === 0) {
      const seeded = createSeedBirthdays();
      localStorage.setItem(LS_INITIALIZED_KEY, 'true');
      await saveBirthdaysToVault(seeded);
      await saveSettingsToVault(DEFAULT_NOTIFICATION_SETTINGS);
      return {
        birthdays: seeded,
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        logs: [],
      };
    }

    return {
      birthdays,
      settings: settingsRecord?.value ?? DEFAULT_NOTIFICATION_SETTINGS,
      logs: logsRecord?.value ?? [],
    };
  } catch {
    // Fallback cleanly to localStorage if IndexedDB is restricted
    if (!alreadyInitialized) {
      const seeded = createSeedBirthdays();
      localStorage.setItem(LS_INITIALIZED_KEY, 'true');
      localStorage.setItem(LS_BIRTHDAYS_KEY, JSON.stringify(seeded));
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
      return {
        birthdays: seeded,
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        logs: [],
      };
    }

    const rawBirthdays = localStorage.getItem(LS_BIRTHDAYS_KEY);
    const rawSettings = localStorage.getItem(LS_SETTINGS_KEY);
    const rawLogs = localStorage.getItem(LS_LOGS_KEY);

    return {
      birthdays: rawBirthdays ? (JSON.parse(rawBirthdays) as BirthdayEntry[]) : [],
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

  const validGroups = new Set(['Family', 'Friends', 'Colleagues', 'Community']);
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
      group: validGroups.has(item.group) ? item.group : 'Friends',
      note: typeof item.note === 'string' ? item.note.slice(0, 280) : '',
      advanceDays: validAdvance.has(item.advanceDays) ? item.advanceDays : 1,
      celebratedYears: Array.isArray(item.celebratedYears)
        ? item.celebratedYears.filter((y): y is number => typeof y === 'number')
        : [],
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

export function buildCSVExport(birthdays: BirthdayEntry[]): string {
  const headers = [
    'id',
    'name',
    'month',
    'day',
    'birthYear',
    'group',
    'advanceDays',
    'note',
    'celebratedYears',
  ];
  const rows = birthdays.map((entry) =>
    [
      escapeCsvCell(entry.id),
      escapeCsvCell(entry.name),
      escapeCsvCell(entry.month),
      escapeCsvCell(entry.day),
      escapeCsvCell(entry.birthYear),
      escapeCsvCell(entry.group),
      escapeCsvCell(entry.advanceDays),
      escapeCsvCell(entry.note),
      escapeCsvCell(entry.celebratedYears.join(';')),
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
}

function parseCsvRows(rawCsv: string): string[][] {
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
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseFlexibleDateString(raw: string): {
  month: number;
  day: number;
  birthYear: number | null;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
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

  // MM/DD/YYYY or MM-DD-YYYY
  const mdyYearMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (mdyYearMatch) {
    const month = Number(mdyYearMatch[1]);
    const day = Number(mdyYearMatch[2]);
    const year = Number(mdyYearMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthYear: year >= 1900 && year <= 2100 ? year : null,
      };
    }
  }

  // MM/DD or MM-DD
  const mdMatch = /^(\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (mdMatch) {
    const month = Number(mdMatch[1]);
    const day = Number(mdMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {month, day, birthYear: null};
    }
  }

  return null;
}

export function parseImportedCSV(rawCsv: string): BirthdayEntry[] {
  const rows = parseCsvRows(rawCsv);
  if (rows.length < 2) {
    throw new Error('CSV file must include a header row and at least one birthday entry.');
  }

  const headerMap = new Map<string, number>();
  rows[0].forEach((header, idx) => {
    headerMap.set(normalizeHeaderKey(header), idx);
  });

  const colIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headerMap.get(alias);
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const nameIdx = colIndex('name', 'fullname', 'person');
  const monthIdx = colIndex('month');
  const dayIdx = colIndex('day');
  const dateIdx = colIndex('date', 'birthday', 'birthdate', 'dob');

  if (nameIdx === -1 || ((monthIdx === -1 || dayIdx === -1) && dateIdx === -1)) {
    throw new Error(
      'Invalid CSV columns: expected "name" along with "month" & "day" (or a "date" column).'
    );
  }

  const idIdx = colIndex('id');
  const yearIdx = colIndex('birthyear', 'year');
  const groupIdx = colIndex('group', 'circle', 'relationship');
  const advanceIdx = colIndex('advancedays', 'noticedays', 'reminderdays');
  const noteIdx = colIndex('note', 'notes', 'memo');
  const celebratedIdx = colIndex('celebratedyears');

  const validGroups = new Map<string, RelationshipGroup>([
    ['family', 'Family'],
    ['friends', 'Friends'],
    ['colleagues', 'Colleagues'],
    ['community', 'Community'],
  ]);
  const validAdvance = new Set<AdvanceNoticeDays>([0, 1, 3, 7]);
  const nowIso = new Date().toISOString();

  const parsedEntries: BirthdayEntry[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[nameIdx] ?? '').trim().slice(0, 80);
    if (!name) continue;

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
      const parsedDate = parseFlexibleDateString(cells[dateIdx] ?? '');
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
      continue;
    }

    const rawGroup = groupIdx !== -1 ? (cells[groupIdx] ?? '').trim().toLowerCase() : '';
    const group: RelationshipGroup = validGroups.get(rawGroup) ?? 'Friends';

    const rawAdvance =
      advanceIdx !== -1 ? Number.parseInt((cells[advanceIdx] ?? '').trim(), 10) : 1;
    const advanceDays: AdvanceNoticeDays = validAdvance.has(rawAdvance as AdvanceNoticeDays)
      ? (rawAdvance as AdvanceNoticeDays)
      : 1;

    const note = noteIdx !== -1 ? (cells[noteIdx] ?? '').trim().slice(0, 280) : '';
    const rawId = idIdx !== -1 ? (cells[idIdx] ?? '').trim() : '';

    const celebratedYears =
      celebratedIdx !== -1
        ? (cells[celebratedIdx] ?? '')
            .split(/[;|]/)
            .map((v) => Number.parseInt(v.trim(), 10))
            .filter((y) => Number.isInteger(y) && y >= 1900 && y <= 2200)
        : [];

    parsedEntries.push({
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

  if (parsedEntries.length === 0) {
    throw new Error('No valid birthday rows found in the CSV file.');
  }

  return parsedEntries;
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
