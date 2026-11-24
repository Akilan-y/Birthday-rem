import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Columns3,
  Download,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {useFirebase} from '../contexts/FirebaseContext';
import type {ParallelSyncStatus} from '../hooks/useSheetsParallelSync';
import type {BirthdayEntry} from '../types/birthday';
import {formatShortDate} from '../utils/dateMath';
import {
  type ConfiguredSheetTarget,
  createBirthdaysSpreadsheet,
  type DriveSpreadsheetFile,
  getSpreadsheetMetadata,
  listUserSpreadsheets,
  readBirthdaysFromSheetTab,
  type SpreadsheetMetadata,
  WorkspaceAuthError,
  writeBirthdaysToSheetTab,
} from '../utils/googleSheets';
import {
  formatReminderLabel,
  type SheetIncompleteRow,
} from '../utils/localStorageVault';

interface GoogleSheetsPanelProps {
  birthdays: BirthdayEntry[];
  onImportBirthdays: (imported: BirthdayEntry[]) => Promise<void> | void;
  onReplaceBirthdays: (next: BirthdayEntry[]) => Promise<void> | void;
  configuredTarget: ConfiguredSheetTarget | null;
  onUpdateConfiguredTarget: (next: ConfiguredSheetTarget | null) => void;
  incompleteRows: SheetIncompleteRow[];
  onUpdateIncompleteRows: (rows: SheetIncompleteRow[]) => void;
  syncStatus: ParallelSyncStatus;
  syncError: string | null;
  onEnableParallelSync: (
    target: Omit<ConfiguredSheetTarget, 'parallelSyncEnabled'>
  ) => Promise<{
    entries: BirthdayEntry[];
    incompleteRows: SheetIncompleteRow[];
    summary: string;
  } | null>;
  onPauseParallelSync: () => void;
  onSyncNow: () => Promise<{
    entries: BirthdayEntry[];
    incompleteRows: SheetIncompleteRow[];
    summary: string;
  } | null>;
  onRecordSnapshot: (entries: BirthdayEntry[], incomplete: SheetIncompleteRow[]) => void;
}

type PendingModalAction =
  | {
      kind: 'overwrite';
      spreadsheetId: string;
      spreadsheetTitle: string;
      tabTitle: string;
    }
  | {
      kind: 'enable-parallel';
      spreadsheetId: string;
      spreadsheetTitle: string;
      tabTitle: string;
      missingColumns: string[];
    };

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  birthdays,
  onImportBirthdays,
  configuredTarget,
  onUpdateConfiguredTarget,
  incompleteRows,
  onUpdateIncompleteRows,
  syncStatus,
  syncError,
  onEnableParallelSync,
  onPauseParallelSync,
  onSyncNow,
  onRecordSnapshot,
}) => {
  const {user, workspaceToken, connectWorkspace, invalidateWorkspaceToken} = useFirebase();

  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const [selectedFileId, setSelectedFileId] = useState('');
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTab, setSelectedTab] = useState('');
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [parsedPreview, setParsedPreview] = useState<BirthdayEntry[]>([]);
  const [tabIncompleteRows, setTabIncompleteRows] = useState<SheetIncompleteRow[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [isLoadingRows, setIsLoadingRows] = useState(false);

  const [newSheetTitle, setNewSheetTitle] = useState(
    `Events (${new Date().toISOString().slice(0, 10)})`
  );
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncingWrite, setIsSyncingWrite] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingModalAction | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof WorkspaceAuthError) {
        invalidateWorkspaceToken();
        setErrorMessage(err.message);
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : fallback);
    },
    [invalidateWorkspaceToken]
  );

  const loadSpreadsheets = useCallback(
    async (queryText?: string) => {
      if (!workspaceToken) return;
      setIsLoadingFiles(true);
      setErrorMessage(null);
      try {
        const files = await listUserSpreadsheets(workspaceToken, queryText);
        setSpreadsheets(files);
        if (files.length > 0) {
          setSelectedFileId((prev) => {
            if (prev && files.some((f) => f.id === prev)) return prev;
            if (
              configuredTarget &&
              files.some((f) => f.id === configuredTarget.spreadsheetId)
            ) {
              return configuredTarget.spreadsheetId;
            }
            const eventsCandidate =
              files.find((f) => f.name.trim().toLowerCase() === 'events') ??
              files.find((f) => f.name.toLowerCase().includes('events'));
            return eventsCandidate?.id ?? files[0].id;
          });
        } else {
          setSelectedFileId('');
          setMetadata(null);
          setSelectedTab('');
          setSheetRows([]);
          setParsedPreview([]);
          setTabIncompleteRows([]);
          setMissingColumns([]);
        }
      } catch (err) {
        handleApiError(err, 'Unable to load Google Spreadsheets.');
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [workspaceToken, handleApiError, configuredTarget]
  );

  useEffect(() => {
    if (workspaceToken) {
      void loadSpreadsheets();
    } else {
      setSpreadsheets([]);
      setSelectedFileId('');
      setMetadata(null);
      setSelectedTab('');
      setSheetRows([]);
      setParsedPreview([]);
      setTabIncompleteRows([]);
      setMissingColumns([]);
    }
  }, [workspaceToken, loadSpreadsheets]);

  const loadMetadata = useCallback(
    async (spreadsheetId: string) => {
      if (!workspaceToken || !spreadsheetId) return;
      setIsLoadingMeta(true);
      setErrorMessage(null);
      try {
        const meta = await getSpreadsheetMetadata(workspaceToken, spreadsheetId);
        setMetadata(meta);
        const preferredTab =
          configuredTarget?.spreadsheetId === spreadsheetId &&
          meta.tabs.some((t) => t.title === configuredTarget.tabTitle)
            ? configuredTarget.tabTitle
            : (meta.tabs[0]?.title ?? '');
        setSelectedTab(preferredTab);
      } catch (err) {
        handleApiError(err, 'Unable to inspect spreadsheet tabs.');
      } finally {
        setIsLoadingMeta(false);
      }
    },
    [workspaceToken, handleApiError, configuredTarget]
  );

  useEffect(() => {
    if (workspaceToken && selectedFileId) {
      void loadMetadata(selectedFileId);
    }
  }, [workspaceToken, selectedFileId, loadMetadata]);

  const loadTabValues = useCallback(
    async (spreadsheetId: string, tabTitle: string) => {
      if (!workspaceToken || !spreadsheetId || !tabTitle) return;
      setIsLoadingRows(true);
      setParseNotice(null);
      setErrorMessage(null);
      try {
        const result = await readBirthdaysFromSheetTab(
          workspaceToken,
          spreadsheetId,
          tabTitle
        );
        setSheetRows(result.rawRows);
        setParsedPreview(result.parsed);
        setTabIncompleteRows(result.incompleteRows);
        setMissingColumns(result.missingExtraColumns);

        if (result.rawRows.length === 0) {
          setParseNotice(
            'This tab is empty. Enable Parallel Sync or push your birthdays to populate it with Circle, Reminder, and Note columns.'
          );
        } else if (result.parsed.length === 0) {
          setParseNotice(
            'No dated birthday rows detected yet. Expected "Names" (or "Name") with "Date" (or "Month" & "Day").'
          );
        } else if (result.incompleteRows.length > 0) {
          setParseNotice(
            `Loaded ${result.parsed.length} dated entries. ${result.incompleteRows.length} row(s) without dates (${result.incompleteRows
              .map((r) => r.name)
              .join(', ')}) will be preserved in the sheet.`
          );
        }
      } catch (err) {
        setSheetRows([]);
        setParsedPreview([]);
        setTabIncompleteRows([]);
        setMissingColumns([]);
        if (err instanceof WorkspaceAuthError) {
          handleApiError(err, 'Session expired.');
        } else {
          setParseNotice(
            err instanceof Error ? err.message : 'Unable to parse tab rows as birthdays.'
          );
        }
      } finally {
        setIsLoadingRows(false);
      }
    },
    [workspaceToken, handleApiError]
  );

  useEffect(() => {
    if (workspaceToken && selectedFileId && selectedTab) {
      void loadTabValues(selectedFileId, selectedTab);
    }
  }, [workspaceToken, selectedFileId, selectedTab, loadTabValues]);

  // Refresh tab preview when background sync finishes
  useEffect(() => {
    if (
      syncStatus === 'synced' &&
      workspaceToken &&
      configuredTarget?.parallelSyncEnabled &&
      selectedFileId === configuredTarget.spreadsheetId &&
      selectedTab === configuredTarget.tabTitle
    ) {
      void loadTabValues(selectedFileId, selectedTab);
    }
  }, [
    configuredTarget?.lastSyncedAt,
    configuredTarget?.parallelSyncEnabled,
    configuredTarget?.spreadsheetId,
    configuredTarget?.tabTitle,
    loadTabValues,
    selectedFileId,
    selectedTab,
    syncStatus,
    workspaceToken,
  ]);

  const handleCreateNewSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceToken || isCreatingSheet) return;
    setIsCreatingSheet(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const created = await createBirthdaysSpreadsheet(
        workspaceToken,
        newSheetTitle,
        birthdays,
        {tabTitle: 'Events', incompleteRows}
      );
      const createdTab = created.tabs[0]?.title ?? 'Events';
      onRecordSnapshot(birthdays, incompleteRows);
      const nextTarget: ConfiguredSheetTarget = {
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: created.title,
        tabTitle: createdTab,
        parallelSyncEnabled: true,
        lastSyncedAt: new Date().toISOString(),
        lastSyncSummary: `Created with ${birthdays.length} rows + Circle, Reminder, Note columns`,
      };
      onUpdateConfiguredTarget(nextTarget);

      setStatusMessage(
        `Created "${created.title}" with Circle, Reminder, and Note columns and enabled Parallel Sync.`
      );
      await loadSpreadsheets();
      setSelectedFileId(created.spreadsheetId);
      setMetadata(created);
      setSelectedTab(createdTab);
    } catch (err) {
      handleApiError(err, 'Failed to create Google Spreadsheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleRequestManualSync = () => {
    const target = configuredTarget
      ? {
          spreadsheetId: configuredTarget.spreadsheetId,
          spreadsheetTitle: configuredTarget.spreadsheetTitle,
          tabTitle: configuredTarget.tabTitle,
        }
      : selectedFileId && selectedTab
      ? {
          spreadsheetId: selectedFileId,
          spreadsheetTitle: metadata?.title ?? 'Selected Spreadsheet',
          tabTitle: selectedTab,
        }
      : null;

    if (!target) {
      setErrorMessage('Select or create a Google Spreadsheet first before syncing.');
      return;
    }

    setErrorMessage(null);
    setPendingAction({
      kind: 'overwrite',
      ...target,
    });
  };

  const handleImportFromTab = async () => {
    if (parsedPreview.length === 0) return;
    setErrorMessage(null);
    await onImportBirthdays(parsedPreview);
    if (tabIncompleteRows.length > 0) {
      onUpdateIncompleteRows(tabIncompleteRows);
    }
    setStatusMessage(
      `Imported ${parsedPreview.length} ${parsedPreview.length === 1 ? 'entry' : 'entries'} from "${metadata?.title ?? 'Google Sheet'}" (${selectedTab}) into Broll.`
    );
  };

  const handleConfirmPendingAction = async () => {
    if (!workspaceToken || !pendingAction) return;
    setIsSyncingWrite(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (pendingAction.kind === 'enable-parallel') {
        const result = await onEnableParallelSync({
          spreadsheetId: pendingAction.spreadsheetId,
          spreadsheetTitle: pendingAction.spreadsheetTitle,
          tabTitle: pendingAction.tabTitle,
        });
        const targetId = pendingAction.spreadsheetId;
        const targetTab = pendingAction.tabTitle;
        setPendingAction(null);
        setStatusMessage(
          result?.summary
            ? `Parallel sync enabled · ${result.summary}`
            : `Parallel two-way sync enabled with "${pendingAction.spreadsheetTitle}".`
        );
        if (selectedFileId === targetId && selectedTab === targetTab) {
          await loadTabValues(targetId, targetTab);
        }
      } else {
        const preservedPending =
          selectedFileId === pendingAction.spreadsheetId &&
          selectedTab === pendingAction.tabTitle &&
          tabIncompleteRows.length > 0
            ? tabIncompleteRows
            : incompleteRows;

        const count = await writeBirthdaysToSheetTab(
          workspaceToken,
          pendingAction.spreadsheetId,
          pendingAction.tabTitle,
          birthdays,
          preservedPending
        );

        onUpdateIncompleteRows(preservedPending);
        onRecordSnapshot(birthdays, preservedPending);

        const updatedTarget: ConfiguredSheetTarget = {
          spreadsheetId: pendingAction.spreadsheetId,
          spreadsheetTitle: pendingAction.spreadsheetTitle,
          tabTitle: pendingAction.tabTitle,
          parallelSyncEnabled: configuredTarget?.parallelSyncEnabled ?? false,
          lastSyncedAt: new Date().toISOString(),
          lastSyncSummary: `Pushed ${count} entries with Circle, Reminder, Note columns`,
        };
        onUpdateConfiguredTarget(updatedTarget);

        const syncedId = pendingAction.spreadsheetId;
        const syncedTab = pendingAction.tabTitle;
        setPendingAction(null);
        setStatusMessage(
          `Synced ${count} ${count === 1 ? 'birthday' : 'birthdays'} to "${updatedTarget.spreadsheetTitle}" (${syncedTab}) with Circle, Reminder, and Note columns.`
        );
        if (selectedFileId === syncedId && selectedTab === syncedTab) {
          await loadTabValues(syncedId, syncedTab);
        }
      }
    } catch (err) {
      setPendingAction(null);
      handleApiError(err, 'Failed to sync with Google Sheets.');
    } finally {
      setIsSyncingWrite(false);
    }
  };

  const handleManualSyncNow = async () => {
    setErrorMessage(null);
    const res = await onSyncNow();
    if (res) {
      setStatusMessage(res.summary);
    }
  };

  const isCurrentTabConfigured =
    Boolean(configuredTarget) &&
    configuredTarget?.spreadsheetId === selectedFileId &&
    configuredTarget?.tabTitle === selectedTab;

  const isCurrentTabParallel =
    isCurrentTabConfigured && Boolean(configuredTarget?.parallelSyncEnabled);

  return (
    <section aria-label="Google Sheets integration" className="space-y-6">
      <div className="pb-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight text-neutral-950 dark:text-neutral-50">
            Google Sheets Parallel Sync
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Keep your Google Sheet and Broll updated in parallel with{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-200">
              Circle, Reminder, and Note
            </span>{' '}
            columns. Edits on either side sync automatically once connected.
          </p>
        </div>

        {workspaceToken && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {configuredTarget?.parallelSyncEnabled && (
              <button
                type="button"
                onClick={handleManualSyncNow}
                disabled={syncStatus === 'syncing'}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-950 dark:text-neutral-50 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                )}
                Sync Both Ways Now
              </button>
            )}

            <button
              type="button"
              onClick={handleRequestManualSync}
              disabled={
                isSyncingWrite || (!configuredTarget && (!selectedFileId || !selectedTab))
              }
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {isSyncingWrite ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Sync to Google Sheets
            </button>

            <button
              type="button"
              onClick={() => loadSpreadsheets(searchTerm)}
              disabled={isLoadingFiles}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              Refresh Sheets
            </button>
          </div>
        )}
      </div>

      {/* Live Configured Spreadsheet + Parallel Status Bar */}
      {configuredTarget && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-neutral-600 dark:text-neutral-300 min-w-0">
            <span className="inline-flex items-center gap-1.5 font-medium text-neutral-950 dark:text-neutral-50">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  configuredTarget.parallelSyncEnabled && workspaceToken
                    ? 'bg-neutral-950 dark:bg-white'
                    : 'bg-neutral-400 dark:bg-neutral-600'
                }`}
              />
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
              {configuredTarget.parallelSyncEnabled
                ? workspaceToken
                  ? syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Parallel Sync Active'
                  : 'Sign in with Google to resume live sync'
                : 'Manual Sync Only'}
            </span>
            <span aria-hidden="true" className="text-neutral-400">
              ·
            </span>
            <span className="truncate font-medium text-neutral-950 dark:text-neutral-50 underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700">
              {configuredTarget.spreadsheetTitle} ({configuredTarget.tabTitle})
            </span>
            {configuredTarget.lastSyncedAt && (
              <>
                <span aria-hidden="true" className="text-neutral-400">
                  ·
                </span>
                <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                  {new Date(configuredTarget.lastSyncedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
            {configuredTarget.lastSyncSummary && (
              <>
                <span aria-hidden="true" className="text-neutral-400">
                  ·
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {configuredTarget.lastSyncSummary}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
              {birthdays.length} synced
              {incompleteRows.length > 0 ? ` + ${incompleteRows.length} pending date` : ''}
            </span>
            {workspaceToken && configuredTarget.parallelSyncEnabled ? (
              <button
                type="button"
                onClick={onPauseParallelSync}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
            ) : workspaceToken ? (
              <button
                type="button"
                onClick={() =>
                  setPendingAction({
                    kind: 'enable-parallel',
                    spreadsheetId: configuredTarget.spreadsheetId,
                    spreadsheetTitle: configuredTarget.spreadsheetTitle,
                    tabTitle: configuredTarget.tabTitle,
                    missingColumns,
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-medium cursor-pointer"
              >
                <Play className="w-3 h-3" />
                Enable Parallel Sync
              </button>
            ) : null}
          </div>
        </div>
      )}

      {syncError && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {syncError}
        </p>
      )}

      {!workspaceToken ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 sm:p-8 max-w-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-neutral-900 dark:text-neutral-100 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
                {user
                  ? 'Authorize Google Sheets Access'
                  : 'Connect your Google account for Parallel Sheets Sync'}
              </h3>
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {user
                  ? 'For your privacy, Google Sheets access tokens stay strictly in browser memory and reset on reload. Sign in with Google again to resume two-way parallel updates with your spreadsheet.'
                  : 'Sign in with Google to connect your Events spreadsheet, add the Circle, Reminder, and Note columns, and keep updates flowing in parallel between Google Sheets and Broll.'}
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={connectWorkspace}
                  className="inline-flex items-center gap-3 px-4 py-2.5 min-h-[42px] rounded-lg bg-white text-neutral-950 border border-neutral-300 hover:bg-neutral-100 active:bg-neutral-200 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-4 h-4 shrink-0 block"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: Create new sheet + Browse spreadsheets */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleCreateNewSheet}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                <FilePlus2 className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                <span>Create New Google Sheet</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Create a Google Sheet with{' '}
                <span className="font-medium text-neutral-900 dark:text-neutral-200">
                  Sl. No., Names, Date, Event, Circle, Reminder, Note
                </span>{' '}
                columns and enable parallel sync for all{' '}
                <span className="font-mono tabular-nums">{birthdays.length}</span> entries.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="Spreadsheet title"
                  aria-label="New spreadsheet title"
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white"
                />
                <button
                  type="submit"
                  disabled={isCreatingSheet}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingSheet ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FilePlus2 className="w-4 h-4" />
                  )}
                  Create & Sync
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  Your Spreadsheets
                </h3>
                <span className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {spreadsheets.length} found
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void loadSpreadsheets(searchTerm);
                      }
                    }}
                    placeholder="Filter sheets by title..."
                    aria-label="Filter Google Spreadsheets"
                    className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadSpreadsheets(searchTerm)}
                  className="px-3 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer"
                >
                  Search
                </button>
              </div>

              {isLoadingFiles ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading spreadsheets from Google Drive...</span>
                </div>
              ) : spreadsheets.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  No Google Spreadsheets found. Create one above to get started.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {spreadsheets.map((file) => {
                    const isSelected = file.id === selectedFileId;
                    const isConnectedTarget = configuredTarget?.spreadsheetId === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-neutral-950 dark:border-white bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">
                            {file.name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {isConnectedTarget && (
                              <span
                                className={`text-[10px] font-mono uppercase tracking-wider font-medium ${
                                  isSelected
                                    ? 'text-neutral-300 dark:text-neutral-600'
                                    : 'text-neutral-950 dark:text-neutral-50'
                                }`}
                              >
                                Connected
                              </span>
                            )}
                            {file.modifiedTime && (
                              <span
                                className={`font-mono text-[10px] tabular-nums ${
                                  isSelected
                                    ? 'text-neutral-300 dark:text-neutral-600'
                                    : 'text-neutral-400 dark:text-neutral-500'
                                }`}
                              >
                                {new Date(file.modifiedTime).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Selected Sheet Tab Sync & Preview */}
          <div className="lg:col-span-7 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 flex flex-col gap-5">
            {!selectedFileId ? (
              <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
                Select a spreadsheet on the left or create a new one to inspect and sync rows.
              </div>
            ) : isLoadingMeta ? (
              <div className="py-16 flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inspecting spreadsheet tabs...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 truncate">
                        {metadata?.title ?? 'Selected Spreadsheet'}
                      </h3>
                      {metadata?.spreadsheetUrl && (
                        <a
                          href={metadata.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Sheets"
                          aria-label="Open spreadsheet in Google Sheets"
                          className="text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Connect this tab for two-way parallel updates or add Circle, Reminder & Note columns.
                    </p>
                  </div>

                  {metadata && metadata.tabs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label
                        htmlFor="sheet-tab-select"
                        className="text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        Tab:
                      </label>
                      <select
                        id="sheet-tab-select"
                        value={selectedTab}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white cursor-pointer"
                      >
                        {metadata.tabs.map((tab) => (
                          <option key={tab.sheetId} value={tab.title}>
                            {tab.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Extra Columns Prompt Banner if sheet lacks Circle/Reminder/Note/Broll ID */}
                {!isLoadingRows && selectedTab && missingColumns.length > 0 && (
                  <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 text-neutral-700 dark:text-neutral-300">
                      <Columns3 className="w-4 h-4 shrink-0 mt-0.5 text-neutral-900 dark:text-neutral-100" />
                      <span>
                        This sheet is missing extra columns:{' '}
                        <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                          {missingColumns.join(', ')}
                        </span>
                        . Connecting Parallel Sync adds them cleanly while keeping all existing rows.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({
                          kind: 'enable-parallel',
                          spreadsheetId: selectedFileId,
                          spreadsheetTitle: metadata?.title ?? 'Selected Spreadsheet',
                          tabTitle: selectedTab,
                          missingColumns,
                        })
                      }
                      className="px-3 py-1.5 rounded-md bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Add Columns & Enable Parallel Sync
                    </button>
                  </div>
                )}

                {/* Sync Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {isCurrentTabParallel ? (
                    <button
                      type="button"
                      onClick={onPauseParallelSync}
                      className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg border border-neutral-950 dark:border-white bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer hover:opacity-90"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Parallel Sync Active (Pause)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedFileId || !selectedTab) return;
                        setPendingAction({
                          kind: 'enable-parallel',
                          spreadsheetId: selectedFileId,
                          spreadsheetTitle: metadata?.title ?? 'Selected Spreadsheet',
                          tabTitle: selectedTab,
                          missingColumns,
                        });
                      }}
                      disabled={isLoadingRows || !selectedTab}
                      className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Enable Parallel Sync
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleImportFromTab}
                    disabled={isLoadingRows || parsedPreview.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-neutral-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Import {parsedPreview.length > 0 ? `${parsedPreview.length} ` : ''}to Website
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedFileId || !selectedTab) return;
                      setPendingAction({
                        kind: 'overwrite',
                        spreadsheetId: selectedFileId,
                        spreadsheetTitle: metadata?.title ?? 'Selected Spreadsheet',
                        tabTitle: selectedTab,
                      });
                    }}
                    disabled={isLoadingRows || !selectedTab}
                    className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-neutral-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Push {birthdays.length} to This Tab
                  </button>

                  <button
                    type="button"
                    onClick={() => loadTabValues(selectedFileId, selectedTab)}
                    disabled={isLoadingRows || !selectedTab}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRows ? 'animate-spin' : ''}`} />
                    Reload Tab
                  </button>
                </div>

                {statusMessage && (
                  <p className="flex items-center gap-2 text-xs text-neutral-900 dark:text-neutral-100 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{statusMessage}</span>
                  </p>
                )}

                {errorMessage && (
                  <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                    {errorMessage}
                  </p>
                )}

                {parseNotice && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {parseNotice}
                  </p>
                )}

                {/* Sheet Preview Table */}
                <div className="flex-1 min-h-[220px] rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  {isLoadingRows ? (
                    <div className="py-12 flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reading rows from "{selectedTab}"...</span>
                    </div>
                  ) : parsedPreview.length > 0 ? (
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                          <tr>
                            <th className="py-2.5 px-3 font-medium">Name</th>
                            <th className="py-2.5 px-3 font-medium">Date</th>
                            <th className="py-2.5 px-3 font-medium">Year</th>
                            <th className="py-2.5 px-3 font-medium">Circle</th>
                            <th className="py-2.5 px-3 font-medium">Reminder</th>
                            <th className="py-2.5 px-3 font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          {parsedPreview.slice(0, 35).map((entry) => (
                            <tr
                              key={entry.id}
                              className="text-neutral-900 dark:text-neutral-100"
                            >
                              <td className="py-2 px-3 font-medium whitespace-nowrap">
                                {entry.name}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                                {formatShortDate(entry.month, entry.day)}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                                {entry.birthYear ?? '—'}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {entry.group}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                                {formatReminderLabel(entry.advanceDays)}
                              </td>
                              <td className="py-2 px-3 text-neutral-500 dark:text-neutral-400 max-w-[180px] truncate">
                                {entry.note || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : sheetRows.length > 0 ? (
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          {sheetRows.slice(0, 12).map((row, idx) => (
                            <tr key={idx} className="text-neutral-700 dark:text-neutral-300">
                              {row.slice(0, 6).map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3 truncate max-w-[160px]">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400">
                      Tab "{selectedTab}" has no rows yet.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal for Enabling Parallel Sync or Updating Google Sheet Data */}
      {pendingAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-sheets-overwrite-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-neutral-900 dark:text-neutral-100 shrink-0" />
                <h3
                  id="confirm-sheets-overwrite-title"
                  className="text-base font-semibold text-neutral-950 dark:text-neutral-50"
                >
                  {pendingAction.kind === 'enable-parallel'
                    ? 'Enable Two-Way Parallel Sync'
                    : 'Sync to Google Sheets'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                aria-label="Close confirmation dialog"
                className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingAction.kind === 'enable-parallel' ? (
              <>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Connect tab{' '}
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                    "{pendingAction.tabTitle}"
                  </span>{' '}
                  in{' '}
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                    "{pendingAction.spreadsheetTitle}"
                  </span>{' '}
                  for automatic two-way parallel updates with Broll?
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 list-disc pl-4">
                  <li>
                    Adds{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-200">
                      Circle, Reminder, Note, and Broll ID
                    </span>{' '}
                    columns while keeping your existing names, dates, and incomplete rows intact.
                  </li>
                  <li>
                    Edits made on the website automatically push to this sheet, and edits made in Google Sheets sync back into Broll.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Push{' '}
                  <span className="font-mono font-semibold tabular-nums text-neutral-950 dark:text-neutral-50">
                    {birthdays.length}
                  </span>{' '}
                  {birthdays.length === 1
                    ? 'local birthday entry'
                    : 'local birthday entries'}{' '}
                  to tab{' '}
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                    "{pendingAction.tabTitle}"
                  </span>{' '}
                  in{' '}
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                    "{pendingAction.spreadsheetTitle}"
                  </span>
                  ?
                </p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  Columns will be updated to{' '}
                  <span className="font-medium text-neutral-900 dark:text-neutral-200">
                    Sl. No., Names, Date, Event, Circle, Reminder, Note, Broll ID
                  </span>
                  .
                </p>
              </>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isSyncingWrite}
                className="px-4 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingAction}
                disabled={isSyncingWrite}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {isSyncingWrite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {pendingAction.kind === 'enable-parallel'
                  ? 'Confirm & Enable'
                  : 'Confirm & Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
