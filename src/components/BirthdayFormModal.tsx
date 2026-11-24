import React, {useEffect, useRef, useState} from 'react';
import {Camera, ChevronLeft, ChevronRight, Loader2, User, X} from 'lucide-react';
import type {
  AdvanceNoticeDays,
  BirthdayEntry,
  RelationshipGroup,
} from '../types/birthday';
import {getDaysInMonth, MONTH_NAMES} from '../utils/dateMath';
import {
  createAvatarThumbnailDataUrl,
  uploadPersonPhotoToDrive,
} from '../utils/googleDriveMedia';
import {WorkspaceAuthError} from '../utils/googleSheets';
import {DrivePhoto} from './DrivePhoto';

interface BirthdayFormModalProps {
  isOpen: boolean;
  editingEntry: BirthdayEntry | null;
  initialMonth?: number;
  initialDay?: number;
  defaultAdvanceDays: AdvanceNoticeDays;
  workspaceToken?: string | null;
  onAuthExpired?: () => void;
  onOpenProfile?: (entry: BirthdayEntry) => void;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    draftId?: string;
    name: string;
    month: number;
    day: number;
    birthYear: number | null;
    group: RelationshipGroup;
    note: string;
    advanceDays: AdvanceNoticeDays;
    relation?: string;
    phone?: string;
    email?: string;
    favoriteThings?: string;
    avatarThumb?: string | null;
    avatarFileId?: string | null;
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
  workspaceToken = null,
  onAuthExpired,
  onOpenProfile,
  onClose,
  onSave,
}) => {
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [birthYearText, setBirthYearText] = useState('');
  const [group, setGroup] = useState<RelationshipGroup>('Friends');
  const [advanceDays, setAdvanceDays] = useState<AdvanceNoticeDays>(defaultAdvanceDays);
  const [note, setNote] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [favoriteThings, setFavoriteThings] = useState('');
  const [avatarThumb, setAvatarThumb] = useState<string | null>(null);
  const [avatarFileId, setAvatarFileId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingEntry) {
      setDraftId(editingEntry.id);
      setName(editingEntry.name);
      setMonth(editingEntry.month);
      setDay(editingEntry.day);
      setBirthYearText(editingEntry.birthYear ? String(editingEntry.birthYear) : '');
      setGroup(editingEntry.group);
      setAdvanceDays(editingEntry.advanceDays);
      setNote(editingEntry.note);
      setRelation(editingEntry.relation ?? '');
      setPhone(editingEntry.phone ?? '');
      setEmail(editingEntry.email ?? '');
      setFavoriteThings(editingEntry.favoriteThings ?? '');
      setAvatarThumb(editingEntry.avatarThumb ?? null);
      setAvatarFileId(editingEntry.avatarFileId ?? null);
    } else {
      const now = new Date();
      setDraftId(crypto.randomUUID());
      setName('');
      setMonth(initialMonth ?? now.getMonth() + 1);
      setDay(initialDay ?? (initialMonth ? 1 : now.getDate()));
      setBirthYearText('');
      setGroup('Friends');
      setAdvanceDays(defaultAdvanceDays);
      setNote('');
      setRelation('');
      setPhone('');
      setEmail('');
      setFavoriteThings('');
      setAvatarThumb(null);
      setAvatarFileId(null);
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

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    setIsUploadingPhoto(true);
    setError(null);
    try {
      const thumb = await createAvatarThumbnailDataUrl(file, 160);
      setAvatarThumb(thumb);
      if (workspaceToken) {
        const personLabel = name.trim() || 'Person';
        const uploaded = await uploadPersonPhotoToDrive(workspaceToken, {
          personId: editingEntry?.id ?? draftId,
          personName: personLabel,
          kind: 'avatar',
          file,
          caption: `Profile photo for ${personLabel}`,
        });
        setAvatarFileId(uploaded.driveFileId ?? null);
      }
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired?.();
      }
      setError(err instanceof Error ? err.message : 'Could not process profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
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
      draftId: editingEntry ? undefined : draftId,
      name: trimmedName,
      month,
      day: clampedDay,
      birthYear: parsedYear,
      group,
      note: note.trim(),
      advanceDays,
      relation: relation.trim(),
      phone: phone.trim(),
      email: email.trim(),
      favoriteThings: favoriteThings.trim(),
      avatarThumb,
      avatarFileId,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-modal-title"
    >
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2
            id="birthday-modal-title"
            className="font-display text-lg font-medium text-neutral-950 dark:text-white"
          >
            {editingEntry
              ? group === 'Remembrance'
                ? 'Edit Remembrance'
                : 'Edit Birthday'
              : group === 'Remembrance'
              ? 'New Remembrance Entry'
              : 'New Birthday Entry'}
          </h2>
          <div className="flex items-center gap-2">
            {editingEntry && onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfile(editingEntry);
                }}
                className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                Profile &amp; Gallery
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="min-h-[34px] min-w-[34px] -mr-1 rounded-lg inline-flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Profile Photo Picker */}
          <div className="flex items-center gap-4 pb-2">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
              <DrivePhoto
                driveFileId={avatarFileId}
                fallbackUrl={avatarThumb}
                workspaceToken={workspaceToken}
                alt={name || 'Profile preview'}
                onAuthExpired={onAuthExpired}
                fallback={<User className="w-6 h-6 text-neutral-400" />}
              />
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelected}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                {avatarThumb || avatarFileId ? 'Change Photo' : 'Add Profile Photo'}
              </button>
              {(avatarThumb || avatarFileId) && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarThumb(null);
                    setAvatarFileId(null);
                  }}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-lg text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label
              htmlFor="bday-name"
              className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
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
                className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
              />
            </div>
          </div>

          {/* Date */}
          <div className="grid grid-cols-12 items-center gap-3">
            <span className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Date
            </span>
            <div className="col-span-9 grid grid-cols-3 gap-2">
              <select
                id="bday-month"
                aria-label="Month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="col-span-2 min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option
                    key={mName}
                    value={idx + 1}
                    className="bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white"
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
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
              >
                {Array.from({length: maxDay}, (_, i) => i + 1).map((d) => (
                  <option
                    key={d}
                    value={d}
                    className="bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white"
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
              className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
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
                className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
              />
            </div>
          </div>

          {/* Circle Type */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label
              htmlFor="bday-group"
              className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
            >
              Circle
            </label>
            <div className="col-span-9">
              <select
                id="bday-group"
                value={group}
                onChange={(e) => setGroup(e.target.value as RelationshipGroup)}
                className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
              >
                {GROUPS.map((g) => (
                  <option
                    key={g}
                    value={g}
                    className="bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white"
                  >
                    {g}
                  </option>
                ))}
              </select>
              {group === 'Remembrance' && (
                <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  For honoring and remembering loved ones who have passed.
                </p>
              )}
            </div>
          </div>

          {/* Reminder Lead Stepper */}
          <div className="grid grid-cols-12 items-center gap-3">
            <span className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Reminder
            </span>
            <div className="col-span-9 flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepAdvance(-1)}
                aria-label="Decrease reminder lead days"
                className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="flex-1 text-center text-xs font-medium text-neutral-950 dark:text-white py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
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
                className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Optional Profile Details */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="grid grid-cols-12 items-center gap-3">
              <label
                htmlFor="bday-relation"
                className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                Relation
              </label>
              <div className="col-span-9">
                <input
                  id="bday-relation"
                  type="text"
                  maxLength={60}
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="Optional (e.g., Sister, Best Friend)"
                  className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-3">
              <label
                htmlFor="bday-phone"
                className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                Phone
              </label>
              <div className="col-span-9">
                <input
                  id="bday-phone"
                  type="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-3">
              <label
                htmlFor="bday-email"
                className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                Email
              </label>
              <div className="col-span-9">
                <input
                  id="bday-email"
                  type="email"
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional"
                  className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-3">
              <label
                htmlFor="bday-favorites"
                className="col-span-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                {group === 'Remembrance' ? 'Memories' : 'Favorites'}
              </label>
              <div className="col-span-9">
                <input
                  id="bday-favorites"
                  type="text"
                  maxLength={280}
                  value={favoriteThings}
                  onChange={(e) => setFavoriteThings(e.target.value)}
                  placeholder={
                    group === 'Remembrance'
                      ? 'Optional cherished memory or song...'
                      : 'Optional gift ideas, favorite coffee...'
                  }
                  className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="grid grid-cols-12 items-start gap-3">
            <label
              htmlFor="bday-note"
              className="col-span-3 pt-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400"
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
                className="w-full px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploadingPhoto}
              className="px-6 py-2 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

