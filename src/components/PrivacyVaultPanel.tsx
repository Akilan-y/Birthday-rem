import React, {useMemo, useRef, useState} from 'react';
import {
  CalendarPlus,
  Check,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import type {BirthdayEntry, NotificationSettings} from '../types/birthday';
import {generateICSContent} from '../utils/dateMath';
import {
  buildBackupPayload,
  buildCSVExport,
  parseBackupFile,
} from '../utils/localStorageVault';
import {PWAInstallButton} from './PWAInstallButton';

interface PrivacyVaultPanelProps {
  birthdays: BirthdayEntry[];
  settings: NotificationSettings;
  vaultBytes: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onImportBirthdays: (
    imported: BirthdayEntry[],
    importedSettings?: NotificationSettings
  ) => void;
  onClearAllData: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isCloudSynced?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const PrivacyVaultPanel: React.FC<PrivacyVaultPanelProps> = ({
  birthdays,
  settings,
  vaultBytes,
  isDarkMode,
  onToggleDarkMode,
  onImportBirthdays,
  onClearAllData,
  userEmail,
  userName,
  isCloudSynced = false,
  onSignIn,
  onSignOut,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'json' | 'csv'>('json');
  const [copiedPreview, setCopiedPreview] = useState(false);

  const formattedBytes =
    vaultBytes < 1024 ? `${vaultBytes} bytes` : `${(vaultBytes / 1024).toFixed(2)} KB`;

  const jsonExportPreview = useMemo(
    () => JSON.stringify(buildBackupPayload(birthdays, settings), null, 2),
    [birthdays, settings]
  );

  const csvExportPreview = useMemo(() => buildCSVExport(birthdays), [birthdays]);

  const activePreviewContent =
    previewFormat === 'csv' ? csvExportPreview : jsonExportPreview;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleExportJson = () => {
    const payload = buildBackupPayload(birthdays, settings);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `broll-birthdays-${dateSlug}.json`;
    triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
    setErrorMessage(null);
    setStatusMessage(
      `Exported ${birthdays.length} ${birthdays.length === 1 ? 'birthday' : 'birthdays'} to ${filename}.`
    );
  };

  const handleExportCsv = () => {
    const csv = buildCSVExport(birthdays);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `broll-birthdays-${dateSlug}.csv`;
    triggerDownload(`\uFEFF${csv}`, filename, 'text/csv;charset=utf-8');
    setErrorMessage(null);
    setStatusMessage(
      `Exported ${birthdays.length} ${birthdays.length === 1 ? 'birthday' : 'birthdays'} to ${filename}.`
    );
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(activePreviewContent);
      setCopiedPreview(true);
      setErrorMessage(null);
      setStatusMessage(`Copied ${previewFormat.toUpperCase()} backup to clipboard.`);
      window.setTimeout(() => setCopiedPreview(false), 2000);
    } catch {
      setErrorMessage('Clipboard access unavailable. Use Export CSV or Export JSON instead.');
    }
  };

  const handleExportICS = () => {
    if (birthdays.length === 0) {
      setErrorMessage('Add at least one birthday before exporting a calendar file.');
      return;
    }
    const ics = generateICSContent(birthdays);
    const dateSlug = new Date().toISOString().slice(0, 10);
    triggerDownload(ics, `broll-birthdays-${dateSlug}.ics`, 'text/calendar;charset=utf-8');
    setErrorMessage(null);
    setStatusMessage(
      `Exported ${birthdays.length} recurring yearly events to an offline .ics calendar file.`
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseBackupFile(file.name, text);
      onImportBirthdays(result.birthdays, result.settings);
      setErrorMessage(null);
      setStatusMessage(
        `Processed ${result.birthdays.length} ${result.birthdays.length === 1 ? 'birthday' : 'birthdays'} from ${result.format.toUpperCase()} backup into your local vault.`
      );
    } catch (err) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to read backup file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section aria-label="Privacy and offline vault" className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium text-slate-900 dark:text-white">
            Privacy & Sync Vault
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Broll keeps all birthday entries locally on your device in IndexedDB with zero analytics. Sign in with Google whenever you want private cross-device cloud sync via Firebase.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.05] text-xs font-medium text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#1D8FE1]" />
                Midnight Slate
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Privacy Guarantee Summary */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-[#1D8FE1] dark:text-[#38BDF8]" />
              <span>Zero-Tracking Architecture</span>
            </div>

            <dl className="mt-5 divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Storage Engine</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-white text-right">
                  {isCloudSynced ? 'Firebase + Local Cache' : 'IndexedDB + LocalStorage'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Vault Footprint</dt>
                <dd className="font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                  {formattedBytes}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Saved Entries</dt>
                <dd className="font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                  {birthdays.length}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Bundled Fonts & Assets</dt>
                <dd className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                  100% Local (No CDN calls)
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Tracking & Analytics</dt>
                <dd className="font-mono text-xs text-emerald-600 dark:text-emerald-400">None</dd>
              </div>
            </dl>
          </div>

          <div className="pt-4 border-t border-slate-200/70 dark:divide-white/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                  <Cloud className="w-3.5 h-3.5 text-[#1D8FE1] dark:text-[#38BDF8]" />
                  <span>{isCloudSynced ? 'Cloud Sync Active' : 'Local-Only Mode'}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isCloudSynced
                    ? `${userName ?? 'Signed in'}${userEmail ? ` · ${userEmail}` : ''}`
                    : 'Sign in with Google to back up birthdays & chat history to Firestore.'}
                </p>
              </div>

              {isCloudSynced && onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              ) : onSignIn ? (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Backup, Calendar Export & Erase */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Portable CSV & JSON Backups
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Export or import your birthday vault as CSV or JSON independently of cloud sync, or generate a standard iCalendar file for native OS reminders.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium text-slate-900 dark:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#1D8FE1] dark:text-[#38BDF8]" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={handleExportICS}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium text-slate-900 dark:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4 text-[#1D8FE1] dark:text-[#38BDF8]" />
                Export .ics
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium text-slate-900 dark:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Import CSV / JSON
              </button>

              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                aria-expanded={showPreview}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Inspect Data
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json,text/csv,.csv"
                onChange={handleFileImport}
                className="sr-only"
                aria-label="Import CSV or JSON backup file"
              />
            </div>

            {showPreview && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Local Snapshot
                    </span>
                    <div
                      role="tablist"
                      aria-label="Preview format"
                      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/70 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07]"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={previewFormat === 'json'}
                        onClick={() => setPreviewFormat('json')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          previewFormat === 'json'
                            ? 'bg-[#1D8FE1] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={previewFormat === 'csv'}
                        onClick={() => setPreviewFormat('csv')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          previewFormat === 'csv'
                            ? 'bg-[#1D8FE1] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPreview}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium text-[#1D8FE1] dark:text-[#38BDF8] hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    {copiedPreview ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy {previewFormat.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#111822] text-[11px] font-mono leading-relaxed text-slate-700 dark:text-slate-300 max-h-56 overflow-auto select-all">
                  {activePreviewContent}
                </pre>
              </div>
            )}

            {statusMessage && (
              <p className="mt-4 text-xs text-emerald-600 dark:text-emerald-400">
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mt-4 text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Erase Local Vault
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Permanently remove all birthdays and alert logs stored in this browser.
                </p>
              </div>

              {confirmClear ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setConfirmClear(false);
                      setStatusMessage('All local data erased.');
                    }}
                    className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Yes, Erase Everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-4 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl border border-rose-500/30 text-xs font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-500/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Erase All Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
