import React, {useEffect, useState} from 'react';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';
import type {
  AdvanceNoticeDays,
  BirthdayEntry,
  RelationshipGroup,
} from '../types/birthday';
import {getDaysInMonth, MONTH_NAMES} from '../utils/dateMath';

interface BirthdayFormModalProps {
  isOpen: boolean;
  editingEntry: BirthdayEntry | null;
  initialMonth?: number;
  initialDay?: number;
  defaultAdvanceDays: AdvanceNoticeDays;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    month: number;
    day: number;
    birthYear: number | null;
    group: RelationshipGroup;
    note: string;
    advanceDays: AdvanceNoticeDays;
  }) => void;
}

const GROUPS: RelationshipGroup[] = ['Family', 'Friends', 'Remembrance'];
const ADVANCE_STEPS: AdvanceNoticeDays[] = [0, 1, 3, 7];

export const BirthdayFormModal: React.FC<BirthdayFormModalProps> = ({
  isOpen,
  editingEntry,
  initialMonth,
  initialDay,
  defaultAdvanceDays,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [birthYearText, setBirthYearText] = useState('');
  const [group, setGroup] = useState<RelationshipGroup>('Friends');
  const [advanceDays, setAdvanceDays] = useState<AdvanceNoticeDays>(defaultAdvanceDays);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingEntry) {
      setName(editingEntry.name);
      setMonth(editingEntry.month);
      setDay(editingEntry.day);
      setBirthYearText(editingEntry.birthYear ? String(editingEntry.birthYear) : '');
      setGroup(editingEntry.group);
      setAdvanceDays(editingEntry.advanceDays);
      setNote(editingEntry.note);
    } else {
      const now = new Date();
      setName('');
      setMonth(initialMonth ?? now.getMonth() + 1);
      setDay(initialDay ?? (initialMonth ? 1 : now.getDate()));
      setBirthYearText('');
      setGroup('Friends');
      setAdvanceDays(defaultAdvanceDays);
      setNote('');
    }
    setError(null);
  }, [isOpen, editingEntry, initialMonth, initialDay, defaultAdvanceDays]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedYear = birthYearText.trim() ? Number(birthYearText.trim()) : null;
  const maxDay = getDaysInMonth(month, parsedYear);
  const clampedDay = Math.min(day, maxDay);

  const stepAdvance = (dir: -1 | 1) => {
    const idx = ADVANCE_STEPS.indexOf(advanceDays);
    const nextIdx = (idx + dir + ADVANCE_STEPS.length) % ADVANCE_STEPS.length;
    setAdvanceDays(ADVANCE_STEPS[nextIdx]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name.');
      return;
    }

    if (birthYearText.trim()) {
      const yr = Number(birthYearText.trim());
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(yr) || yr < 1900 || yr > currentYear) {
        setError(`Birth year must be between 1900 and ${currentYear}.`);
        return;
      }
    }

    onSave({
      id: editingEntry?.id,
      name: trimmedName,
      month,
      day: clampedDay,
      birthYear: parsedYear,
      group,
      note: note.trim(),
      advanceDays,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-modal-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#212A37]/95 backdrop-blur-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.08]">
          <h2
            id="birthday-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            {editingEntry
              ? group === 'Remembrance'
                ? 'Edit Remembrance'
                : 'Edit Birthday'
              : group === 'Remembrance'
              ? 'New Remembrance Entry'
              : 'New Birthday Entry'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[36px] min-w-[36px] -mr-1 rounded-full inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label
              htmlFor="bday-name"
              className="col-span-3 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Name
            </label>
            <div className="col-span-9">
              <input
                id="bday-name"
                type="text"
                required
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alex Rivera"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
              />
            </div>
          </div>

          {/* Date */}
          <div className="grid grid-cols-12 items-center gap-3">
            <span className="col-span-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              Date
            </span>
            <div className="col-span-9 grid grid-cols-3 gap-2">
              <select
                id="bday-month"
                aria-label="Month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="col-span-2 min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8] cursor-pointer"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option
                    key={mName}
                    value={idx + 1}
                    className="bg-white dark:bg-[#212A37] text-slate-900 dark:text-white"
                  >
                    {mName}
                  </option>
                ))}
              </select>

              <select
                id="bday-day"
                aria-label="Day"
                value={clampedDay}
                onChange={(e) => setDay(Number(e.target.value))}
                className="min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8] cursor-pointer"
              >
                {Array.from({length: maxDay}, (_, i) => i + 1).map((d) => (
                  <option
                    key={d}
                    value={d}
                    className="bg-white dark:bg-[#212A37] text-slate-900 dark:text-white"
                  >
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Birth Year */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label
              htmlFor="bday-year"
              className="col-span-3 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Birth Year
            </label>
            <div className="col-span-9">
              <input
                id="bday-year"
                type="number"
                inputMode="numeric"
                min={1900}
                max={new Date().getFullYear()}
                value={birthYearText}
                onChange={(e) => setBirthYearText(e.target.value)}
                placeholder="Optional (e.g. 1994)"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
              />
            </div>
          </div>

          {/* Circle Type */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label
              htmlFor="bday-group"
              className="col-span-3 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Circle
            </label>
            <div className="col-span-9">
              <select
                id="bday-group"
                value={group}
                onChange={(e) => setGroup(e.target.value as RelationshipGroup)}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8] cursor-pointer"
              >
                {GROUPS.map((g) => (
                  <option
                    key={g}
                    value={g}
                    className="bg-white dark:bg-[#212A37] text-slate-900 dark:text-white"
                  >
                    {g}
                  </option>
                ))}
              </select>
              {group === 'Remembrance' && (
                <p className="mt-1.5 text-[11px] text-violet-600 dark:text-violet-300">
                  For honoring and remembering loved ones who have passed.
                </p>
              )}
            </div>
          </div>

          {/* Reminder Lead Stepper */}
          <div className="grid grid-cols-12 items-center gap-3">
            <span className="col-span-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              Reminder
            </span>
            <div className="col-span-9 flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepAdvance(-1)}
                aria-label="Decrease reminder lead days"
                className="w-9 h-9 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.1] inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="flex-1 text-center text-xs font-medium text-slate-900 dark:text-white py-2 px-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05]">
                {advanceDays === 0
                  ? 'On the day'
                  : advanceDays === 1
                  ? '1 day before'
                  : `${advanceDays} days before`}
              </span>
              <button
                type="button"
                onClick={() => stepAdvance(1)}
                aria-label="Increase reminder lead days"
                className="w-9 h-9 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.1] inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="grid grid-cols-12 items-start gap-3">
            <label
              htmlFor="bday-note"
              className="col-span-3 pt-2.5 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Note
            </label>
            <div className="col-span-9">
              <textarea
                id="bday-note"
                rows={2}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  group === 'Remembrance'
                    ? 'Add remembrance note or memorial tribute...'
                    : 'Add gift idea or eco note...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.05] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
          )}

          <div className="pt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 dark:border-white/[0.09] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 min-h-[40px] rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-semibold shadow-[0_6px_16px_rgba(29,143,225,0.35)] transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
