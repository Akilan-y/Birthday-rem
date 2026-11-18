import {useCallback, useEffect, useRef, useState} from 'react';
import type {BirthdayEntry} from '../types/birthday';
import {
  canonicalEntrySignature,
  computeBirthdaysCanonicalHash,
  type ConfiguredSheetTarget,
  loadConfiguredTarget,
  normalizeNameKey,
  readBirthdaysFromSheetTab,
  saveConfiguredTarget,
  WorkspaceAuthError,
  writeBirthdaysToSheetTab,
} from '../utils/googleSheets';
import type {SheetIncompleteRow} from '../utils/localStorageVault';

const LS_INCOMPLETE_ROWS_KEY = 'broll_sheets_incomplete_v1';
const POLL_INTERVAL_MS = 12_000;
const PUSH_DEBOUNCE_MS = 700;

export type ParallelSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

function loadSavedIncompleteRows(): SheetIncompleteRow[] {
  try {
    const raw = localStorage.getItem(LS_INCOMPLETE_ROWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SheetIncompleteRow[]) : [];
  } catch {
    return [];
  }
}

function saveIncompleteRows(rows: SheetIncompleteRow[]): void {
  try {
    localStorage.setItem(LS_INCOMPLETE_ROWS_KEY, JSON.stringify(rows));
  } catch {
    // ignore storage errors
  }
}

interface UseSheetsParallelSyncOptions {
  isLoaded: boolean;
  birthdays: BirthdayEntry[];
  workspaceToken: string | null;
  onApplySheetEntries: (entries: BirthdayEntry[]) => Promise<void> | void;
  onAuthExpired: () => void;
}

export function useSheetsParallelSync({
  isLoaded,
  birthdays,
  workspaceToken,
  onApplySheetEntries,
  onAuthExpired,
}: UseSheetsParallelSyncOptions) {
  const [configuredTarget, setConfiguredTargetState] = useState<ConfiguredSheetTarget | null>(() =>
    loadConfiguredTarget()
  );
  const [incompleteRows, setIncompleteRowsState] = useState<SheetIncompleteRow[]>(() =>
    loadSavedIncompleteRows()
  );
  const [syncStatus, setSyncStatus] = useState<ParallelSyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const birthdaysRef = useRef<BirthdayEntry[]>(birthdays);
  birthdaysRef.current = birthdays;

  const incompleteRef = useRef<SheetIncompleteRow[]>(incompleteRows);
  incompleteRef.current = incompleteRows;

  const targetRef = useRef<ConfiguredSheetTarget | null>(configuredTarget);
  targetRef.current = configuredTarget;

  const tokenRef = useRef<string | null>(workspaceToken);
  tokenRef.current = workspaceToken;

  const baselineMapRef = useRef<Map<string, string>>(new Map());
  const lastLocalHashRef = useRef<string | null>(null);
  const lastSheetHashRef = useRef<string | null>(null);
  const isSyncInFlightRef = useRef(false);
  const suppressNextPushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);

  const updateConfiguredTarget = useCallback((next: ConfiguredSheetTarget | null) => {
    setConfiguredTargetState(next);
    targetRef.current = next;
    saveConfiguredTarget(next);
  }, []);

  const updateIncompleteRows = useCallback((next: SheetIncompleteRow[]) => {
    setIncompleteRowsState(next);
    incompleteRef.current = next;
    saveIncompleteRows(next);
  }, []);

  const recordSnapshot = useCallback(
    (entries: BirthdayEntry[], pending: SheetIncompleteRow[]) => {
      const map = new Map<string, string>();
      for (const e of entries) {
        map.set(e.id, canonicalEntrySignature(e));
      }
      baselineMapRef.current = map;
      const hash = computeBirthdaysCanonicalHash(entries, pending);
      lastLocalHashRef.current = computeBirthdaysCanonicalHash(entries);
      lastSheetHashRef.current = hash;
    },
    []
  );

  const runReconcile = useCallback(
    async (
      mode: 'initial' | 'pull' | 'push' | 'manual',
      overrideTarget?: ConfiguredSheetTarget
    ): Promise<{entries: BirthdayEntry[]; incompleteRows: SheetIncompleteRow[]; summary: string} | null> => {
      const token = tokenRef.current;
      const target = overrideTarget ?? targetRef.current;
      if (!token || !target) return null;
      if (isSyncInFlightRef.current) return null;

      isSyncInFlightRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const localEntries = birthdaysRef.current;
        const currentIncomplete = incompleteRef.current;

        // Fast path for push when we already have a baseline: still check sheet first so concurrent sheet edits aren't clobbered
        const sheetRead = await readBirthdaysFromSheetTab(
          token,
          target.spreadsheetId,
          target.tabTitle
        );

        const nextIncomplete = sheetRead.incompleteRows;
        const currentSheetRawHash = computeBirthdaysCanonicalHash(
          sheetRead.parsed,
          nextIncomplete
        );

        // If polling and sheet hasn't changed at all since last sync, nothing to do
        if (
          mode === 'pull' &&
          lastSheetHashRef.current !== null &&
          currentSheetRawHash === lastSheetHashRef.current &&
          sheetRead.missingExtraColumns.length === 0
        ) {
          setSyncStatus('synced');
          return null;
        }

        const localById = new Map<string, BirthdayEntry>(
          localEntries.map((e) => [e.id, e])
        );

        // Link sheet entries without a matching Broll ID to existing local entries by name+date (or unique name)
        const matchedLocalIds = new Set<string>();
        const localByNameDate = new Map<string, BirthdayEntry>();
        const localByName = new Map<string, BirthdayEntry>();
        for (const e of localEntries) {
          localByNameDate.set(`${normalizeNameKey(e.name)}|${e.month}|${e.day}`, e);
          if (!localByName.has(normalizeNameKey(e.name))) {
            localByName.set(normalizeNameKey(e.name), e);
          }
        }

        let sheetNeedsIdBackfill = false;
        const sheetEntries: BirthdayEntry[] = sheetRead.parsed.map((sheetEntry) => {
          if (localById.has(sheetEntry.id) || baselineMapRef.current.has(sheetEntry.id)) {
            matchedLocalIds.add(sheetEntry.id);
            return sheetEntry;
          }
          const byNameDate = localByNameDate.get(
            `${normalizeNameKey(sheetEntry.name)}|${sheetEntry.month}|${sheetEntry.day}`
          );
          if (byNameDate && !matchedLocalIds.has(byNameDate.id)) {
            matchedLocalIds.add(byNameDate.id);
            sheetNeedsIdBackfill = true;
            return {
              ...sheetEntry,
              id: byNameDate.id,
              celebratedYears: byNameDate.celebratedYears,
              createdAt: byNameDate.createdAt,
            };
          }
          sheetNeedsIdBackfill = true;
          return sheetEntry;
        });

        const sheetById = new Map<string, BirthdayEntry>(
          sheetEntries.map((e) => [e.id, e])
        );

        const baseline = baselineMapRef.current;
        const merged: BirthdayEntry[] = [];
        let addedFromSheet = 0;
        let updatedFromSheet = 0;
        let deletedFromSheet = 0;
        let changedLocally = false;

        if (baseline.size === 0 && (mode === 'initial' || mode === 'manual')) {
          // Union merge on initial attach
          const seen = new Set<string>();
          for (const sheetItem of sheetEntries) {
            seen.add(sheetItem.id);
            const localItem = localById.get(sheetItem.id);
            if (!localItem) {
              merged.push(sheetItem);
              addedFromSheet += 1;
            } else {
              // If sheet lacked Circle/Reminder/Note columns, keep local custom fields
              const mergedItem: BirthdayEntry = {
                ...sheetItem,
                group: sheetRead.missingExtraColumns.includes('Circle')
                  ? localItem.group
                  : sheetItem.group,
                advanceDays: sheetRead.missingExtraColumns.includes('Reminder')
                  ? localItem.advanceDays
                  : sheetItem.advanceDays,
                note: sheetRead.missingExtraColumns.includes('Note')
                  ? localItem.note
                  : sheetItem.note || localItem.note,
                celebratedYears: localItem.celebratedYears,
                createdAt: localItem.createdAt,
              };
              merged.push(mergedItem);
              if (canonicalEntrySignature(mergedItem) !== canonicalEntrySignature(localItem)) {
                updatedFromSheet += 1;
              }
            }
          }
          for (const localItem of localEntries) {
            if (!seen.has(localItem.id)) {
              merged.push(localItem);
              changedLocally = true;
            }
          }
        } else {
          // 3-way reconciliation using baseline
          const allIds = new Set<string>([
            ...baseline.keys(),
            ...localById.keys(),
            ...sheetById.keys(),
          ]);

          for (const id of allIds) {
            const baseSig = baseline.get(id);
            const localItem = localById.get(id);
            const sheetItem = sheetById.get(id);
            const localSig = localItem ? canonicalEntrySignature(localItem) : null;
            const sheetSig = sheetItem ? canonicalEntrySignature(sheetItem) : null;

            if (localItem && sheetItem) {
              if (localSig === sheetSig) {
                merged.push(localItem);
              } else if (sheetSig === baseSig) {
                // Only website changed
                merged.push(localItem);
                changedLocally = true;
              } else if (localSig === baseSig) {
                // Only Google Sheet changed
                merged.push({
                  ...sheetItem,
                  celebratedYears: localItem.celebratedYears,
                  createdAt: localItem.createdAt,
                });
                updatedFromSheet += 1;
              } else if (mode === 'push') {
                merged.push(localItem);
                changedLocally = true;
              } else {
                merged.push({
                  ...sheetItem,
                  celebratedYears: localItem.celebratedYears,
                  createdAt: localItem.createdAt,
                });
                updatedFromSheet += 1;
              }
            } else if (localItem && !sheetItem) {
              if (baseSig !== undefined && mode !== 'push') {
                // Existed in previous sync and removed from Google Sheet
                deletedFromSheet += 1;
              } else {
                // Added on website or pending push
                merged.push(localItem);
                changedLocally = true;
              }
            } else if (!localItem && sheetItem) {
              if (
                baseSig !== undefined &&
                (mode === 'push' || (mode !== 'initial' && sheetSig === baseSig))
              ) {
                // Deleted on website
                changedLocally = true;
              } else {
                // Added in Google Sheet
                merged.push(sheetItem);
                addedFromSheet += 1;
              }
            }
          }
        }

        const mergedLocalHash = computeBirthdaysCanonicalHash(merged);
        const currentWebsiteHash = computeBirthdaysCanonicalHash(localEntries);
        const websiteNeedsUpdate = mergedLocalHash !== currentWebsiteHash;

        const preservedIncomplete =
          nextIncomplete.length > 0 ? nextIncomplete : mode === 'push' ? currentIncomplete : [];

        const shouldWriteSheet =
          changedLocally ||
          sheetRead.missingExtraColumns.length > 0 ||
          sheetNeedsIdBackfill ||
          computeBirthdaysCanonicalHash(merged, preservedIncomplete) !==
            computeBirthdaysCanonicalHash(sheetEntries, nextIncomplete);

        if (websiteNeedsUpdate) {
          suppressNextPushRef.current = true;
          await onApplySheetEntries(merged);
        }

        if (shouldWriteSheet) {
          await writeBirthdaysToSheetTab(
            token,
            target.spreadsheetId,
            target.tabTitle,
            merged,
            preservedIncomplete
          );
        }

        updateIncompleteRows(preservedIncomplete);
        recordSnapshot(merged, preservedIncomplete);

        const parts: string[] = [];
        if (addedFromSheet > 0) parts.push(`+${addedFromSheet} from sheet`);
        if (updatedFromSheet > 0) parts.push(`${updatedFromSheet} updated from sheet`);
        if (deletedFromSheet > 0) parts.push(`${deletedFromSheet} removed from sheet`);
        if (shouldWriteSheet && parts.length === 0) {
          parts.push(`Synced ${merged.length} rows to sheet`);
        }
        const summary =
          parts.length > 0
            ? parts.join(' · ')
            : `Up to date (${merged.length} ${merged.length === 1 ? 'entry' : 'entries'})`;

        const updatedTarget: ConfiguredSheetTarget = {
          ...target,
          lastSyncedAt: new Date().toISOString(),
          lastSyncSummary: summary,
        };
        updateConfiguredTarget(updatedTarget);
        setSyncStatus('synced');

        return {
          entries: merged,
          incompleteRows: preservedIncomplete,
          summary,
        };
      } catch (err) {
        if (err instanceof WorkspaceAuthError) {
          onAuthExpired();
        }
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Parallel sync failed.');
        return null;
      } finally {
        isSyncInFlightRef.current = false;
      }
    },
    [onApplySheetEntries, onAuthExpired, recordSnapshot, updateConfiguredTarget, updateIncompleteRows]
  );

  // Trigger initial pull when user signs in with parallel sync already configured
  useEffect(() => {
    if (!isLoaded || !workspaceToken || !configuredTarget?.parallelSyncEnabled) return;
    void runReconcile('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, workspaceToken, configuredTarget?.spreadsheetId, configuredTarget?.tabTitle, configuredTarget?.parallelSyncEnabled]);

  // Background poll every 12 seconds + immediate sync on window focus / visibility
  useEffect(() => {
    if (!isLoaded || !workspaceToken || !configuredTarget?.parallelSyncEnabled) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runReconcile('pull');
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void runReconcile('pull');
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isLoaded, workspaceToken, configuredTarget?.parallelSyncEnabled, runReconcile]);

  // Debounced auto-push when local website birthdays change
  useEffect(() => {
    if (!isLoaded || !workspaceToken || !configuredTarget?.parallelSyncEnabled) return;

    const nextHash = computeBirthdaysCanonicalHash(birthdays);
    if (suppressNextPushRef.current) {
      suppressNextPushRef.current = false;
      lastLocalHashRef.current = nextHash;
      return;
    }

    if (lastLocalHashRef.current === null) {
      return;
    }

    if (nextHash === lastLocalHashRef.current) {
      return;
    }

    if (pushTimerRef.current !== null) {
      window.clearTimeout(pushTimerRef.current);
    }

    pushTimerRef.current = window.setTimeout(() => {
      void runReconcile('push');
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current !== null) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [isLoaded, birthdays, workspaceToken, configuredTarget?.parallelSyncEnabled, runReconcile]);

  const enableParallelSync = useCallback(
    async (target: Omit<ConfiguredSheetTarget, 'parallelSyncEnabled'>) => {
      baselineMapRef.current = new Map();
      lastLocalHashRef.current = null;
      lastSheetHashRef.current = null;

      const enabledTarget: ConfiguredSheetTarget = {
        ...target,
        parallelSyncEnabled: true,
      };
      updateConfiguredTarget(enabledTarget);
      return await runReconcile('initial', enabledTarget);
    },
    [runReconcile, updateConfiguredTarget]
  );

  const pauseParallelSync = useCallback(() => {
    if (!targetRef.current) return;
    updateConfiguredTarget({
      ...targetRef.current,
      parallelSyncEnabled: false,
    });
    setSyncStatus('idle');
  }, [updateConfiguredTarget]);

  const syncNow = useCallback(async () => {
    return await runReconcile('manual');
  }, [runReconcile]);

  return {
    configuredTarget,
    updateConfiguredTarget,
    incompleteRows,
    updateIncompleteRows,
    syncStatus,
    syncError,
    setSyncError,
    enableParallelSync,
    pauseParallelSync,
    syncNow,
    recordSnapshot,
  };
}
