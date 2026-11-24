import type {BirthdayEntry} from '../types/birthday';
import {
  buildBirthdayTableRows,
  parseTableRowsToBirthdaysDetailed,
  type SheetIncompleteRow,
} from './localStorageVault';

export class WorkspaceAuthError extends Error {
  constructor(message = 'Google session expired. Please sign in with Google again.') {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl?: string;
  tabs: SheetTabInfo[];
}

export interface SheetReadResult {
  rawRows: string[][];
  parsed: BirthdayEntry[];
  incompleteRows: SheetIncompleteRow[];
  missingExtraColumns: string[];
  isEventsSchema: boolean;
  headers: string[];
}

export interface ConfiguredSheetTarget {
  spreadsheetId: string;
  spreadsheetTitle: string;
  tabTitle: string;
  parallelSyncEnabled: boolean;
  lastSyncedAt?: string;
  lastSyncSummary?: string;
}

const LS_SHEETS_CONFIG_KEY = 'broll_sheets_config_v1';

export function loadConfiguredTarget(): ConfiguredSheetTarget | null {
  try {
    const raw = localStorage.getItem(LS_SHEETS_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConfiguredSheetTarget>;
    if (
      typeof parsed?.spreadsheetId === 'string' &&
      parsed.spreadsheetId &&
      typeof parsed?.tabTitle === 'string' &&
      parsed.tabTitle
    ) {
      return {
        spreadsheetId: parsed.spreadsheetId,
        spreadsheetTitle: parsed.spreadsheetTitle ?? 'Configured Spreadsheet',
        tabTitle: parsed.tabTitle,
        parallelSyncEnabled: Boolean(parsed.parallelSyncEnabled),
        lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
        lastSyncSummary:
          typeof parsed.lastSyncSummary === 'string' ? parsed.lastSyncSummary : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfiguredTarget(target: ConfiguredSheetTarget | null): void {
  try {
    if (!target) {
      localStorage.removeItem(LS_SHEETS_CONFIG_KEY);
    } else {
      localStorage.setItem(LS_SHEETS_CONFIG_KEY, JSON.stringify(target));
    }
  } catch {
    // ignore storage restrictions
  }
}

export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function canonicalEntrySignature(entry: BirthdayEntry): string {
  return JSON.stringify([
    normalizeNameKey(entry.name),
    entry.month,
    entry.day,
    entry.birthYear ?? null,
    entry.group,
    entry.advanceDays,
    entry.note.trim(),
  ]);
}

export function computeBirthdaysCanonicalHash(
  entries: BirthdayEntry[],
  incompleteRows: SheetIncompleteRow[] = []
): string {
  const entryParts = entries
    .map((e) => `${e.id}:${canonicalEntrySignature(e)}`)
    .sort();
  const incompleteParts = incompleteRows
    .map((r) => `${normalizeNameKey(r.name)}:${r.event}:${r.group}:${r.advanceDays}:${r.note}`)
    .sort();
  return JSON.stringify({entries: entryParts, incomplete: incompleteParts});
}

function escapeSheetTitleForA1(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function fetchGoogleJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new WorkspaceAuthError();
  }

  if (!res.ok) {
    let errorDetail = `Google API request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as {error?: {message?: string}};
      if (errBody?.error?.message) {
        errorDetail = errBody.error.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(errorDetail);
  }

  return (await res.json()) as T;
}

export async function listUserSpreadsheets(
  accessToken: string,
  searchQuery?: string
): Promise<DriveSpreadsheetFile[]> {
  const clauses = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];
  const trimmedSearch = searchQuery?.trim();
  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
  });

  const data = await fetchGoogleJson<{files?: DriveSpreadsheetFile[]}>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return Array.isArray(data.files) ? data.files : [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields: 'spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title))',
  });

  const data = await fetchGoogleJson<{
    spreadsheetId: string;
    properties?: {title?: string};
    spreadsheetUrl?: string;
    sheets?: Array<{properties?: {sheetId?: number; title?: string}}>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`,
    accessToken
  );

  const tabs: SheetTabInfo[] = (data.sheets ?? [])
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? 'Sheet',
    }))
    .filter((t) => Boolean(t.title));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Untitled Spreadsheet',
    spreadsheetUrl: data.spreadsheetUrl,
    tabs,
  };
}

export async function readBirthdaysFromSheetTab(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<SheetReadResult> {
  const range = `${escapeSheetTitleForA1(sheetTitle)}!A1:Z1000`;
  const data = await fetchGoogleJson<{values?: unknown[][]}>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    accessToken
  );

  const rawRows: string[][] = Array.isArray(data.values)
    ? data.values.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
      )
    : [];

  if (rawRows.length === 0) {
    return {
      rawRows: [],
      parsed: [],
      incompleteRows: [],
      missingExtraColumns: ['Circle', 'Reminder', 'Note', 'Broll ID'],
      isEventsSchema: false,
      headers: [],
    };
  }

  const detail = parseTableRowsToBirthdaysDetailed(rawRows);
  return {
    rawRows,
    parsed: detail.entries,
    incompleteRows: detail.incompleteRows,
    missingExtraColumns: detail.missingExtraColumns,
    isEventsSchema: detail.isEventsSchema,
    headers: detail.headers,
  };
}

export async function createBirthdaysSpreadsheet(
  accessToken: string,
  title: string,
  birthdays: BirthdayEntry[],
  options?: {
    tabTitle?: string;
    incompleteRows?: SheetIncompleteRow[];
  }
): Promise<SpreadsheetMetadata> {
  const safeTitle = title.trim() || `Events (${new Date().toISOString().slice(0, 10)})`;
  const initialTabTitle = options?.tabTitle?.trim() || 'Events';

  const created = await fetchGoogleJson<{
    spreadsheetId: string;
    properties?: {title?: string};
    spreadsheetUrl?: string;
    sheets?: Array<{properties?: {sheetId?: number; title?: string}}>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {title: safeTitle},
      sheets: [{properties: {title: initialTabTitle}}],
    }),
  });

  const tabs: SheetTabInfo[] = (created.sheets ?? []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? initialTabTitle,
  }));
  const targetTab = tabs[0]?.title ?? initialTabTitle;

  const rows = buildBirthdayTableRows(birthdays, options?.incompleteRows ?? []);
  const range = `${escapeSheetTitleForA1(targetTab)}!A1`;

  await fetchGoogleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title ?? safeTitle,
    spreadsheetUrl: created.spreadsheetUrl,
    tabs,
  };
}

export async function writeBirthdaysToSheetTab(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  birthdays: BirthdayEntry[],
  incompleteRows: SheetIncompleteRow[] = []
): Promise<number> {
  const clearRange = `${escapeSheetTitleForA1(sheetTitle)}!A1:Z`;
  await fetchGoogleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(clearRange)}:clear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  const rows = buildBirthdayTableRows(birthdays, incompleteRows);
  const writeRange = `${escapeSheetTitleForA1(sheetTitle)}!A1`;
  await fetchGoogleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  return birthdays.length;
}
