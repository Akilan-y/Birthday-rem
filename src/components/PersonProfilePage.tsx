import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  ImagePlus,
  Loader2,
  Mail,
  Moon,
  Pencil,
  Phone,
  Sun,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type {ComputedBirthday, PersonPhotoItem} from '../types/birthday';
import {
  formatCountdownLabel,
  formatOrdinalAge,
  formatShortDate,
  getCountdownCycleStats,
} from '../utils/dateMath';
import {
  createAvatarThumbnailDataUrl,
  createCompactLocalPreviewUrl,
  deleteDrivePhoto,
  uploadPersonPhotoToDrive,
} from '../utils/googleDriveMedia';
import {WorkspaceAuthError} from '../utils/googleSheets';
import {DrivePhoto} from './DrivePhoto';

interface PersonProfilePageProps {
  entry: ComputedBirthday;
  peopleList: ComputedBirthday[];
  workspaceToken: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSignIn: () => Promise<void>;
  onAuthExpired: () => void;
  onBack: () => void;
  onSelectPerson: (entry: ComputedBirthday) => void;
  onEditCore: (entry: ComputedBirthday) => void;
  onDeletePerson: (id: string) => Promise<void> | void;
  onToggleCelebrated: (entry: ComputedBirthday) => void;
  onUpdateEntry: (updatedFields: Partial<ComputedBirthday> & {id: string}) => Promise<void> | void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatAdvanceLabel(days: number): string {
  if (days === 0) return 'Same day';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

export const PersonProfilePage: React.FC<PersonProfilePageProps> = ({
  entry,
  peopleList,
  workspaceToken,
  isDarkMode,
  onToggleDarkMode,
  onSignIn,
  onAuthExpired,
  onBack,
  onSelectPerson,
  onEditCore,
  onDeletePerson,
  onToggleCelebrated,
  onUpdateEntry,
}) => {
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [favoriteThings, setFavoriteThings] = useState('');
  const [note, setNote] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const [wishCopied, setWishCopied] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(false);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<PersonPhotoItem | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRelation(entry.relation ?? '');
    setPhone(entry.phone ?? '');
    setEmail(entry.email ?? '');
    setFavoriteThings(entry.favoriteThings ?? '');
    setNote(entry.note ?? '');
    setMediaError(null);
    setProfileSavedNotice(false);
    setWishCopied(false);
    setConfirmRemoveAvatar(false);
    setConfirmDeletePerson(false);
    setConfirmDeletePhoto(null);
    setLightboxIndex(null);
    window.scrollTo({top: 0, behavior: 'instant'});
  }, [entry.id]);

  const galleryPhotos = entry.galleryPhotos ?? [];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (e.key === 'Escape') {
          setLightboxIndex(null);
        } else if (e.key === 'ArrowLeft' && galleryPhotos.length > 1) {
          setLightboxIndex((lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length);
        } else if (e.key === 'ArrowRight' && galleryPhotos.length > 1) {
          setLightboxIndex((lightboxIndex + 1) % galleryPhotos.length);
        }
        return;
      }

      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, galleryPhotos.length, onBack]);

  const isRemembrance = entry.group === 'Remembrance';
  const cycleStats = getCountdownCycleStats(entry);
  const currentIndex = peopleList.findIndex((p) => p.id === entry.id);
  const prevPerson =
    peopleList.length > 1 && currentIndex >= 0
      ? peopleList[(currentIndex - 1 + peopleList.length) % peopleList.length]
      : null;
  const nextPerson =
    peopleList.length > 1 && currentIndex >= 0
      ? peopleList[(currentIndex + 1) % peopleList.length]
      : null;

  const sortedCelebratedYears = [...entry.celebratedYears].sort((a, b) => b - a);

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setMediaError(null);
    try {
      await onUpdateEntry({
        id: entry.id,
        relation: relation.trim(),
        phone: phone.trim(),
        email: email.trim(),
        favoriteThings: favoriteThings.trim(),
        note: note.trim(),
      });
      setProfileSavedNotice(true);
      window.setTimeout(() => setProfileSavedNotice(false), 2200);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to save profile details.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCopyWish = async () => {
    const firstName = entry.name.split(/\s+/)[0] || entry.name;
    const wishText = isRemembrance
      ? `Thinking of ${entry.name} today and honoring wonderful memories.`
      : entry.turningAge !== null
      ? `Happy ${formatOrdinalAge(entry.turningAge)} Birthday, ${firstName}! Wishing you a joyful year ahead.`
      : `Happy Birthday, ${firstName}! Wishing you a wonderful day and year ahead.`;
    try {
      await navigator.clipboard.writeText(wishText);
      setWishCopied(true);
      window.setTimeout(() => setWishCopied(false), 2000);
    } catch {
      setMediaError('Could not copy message to clipboard.');
    }
  };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMediaError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    setIsUploadingAvatar(true);
    setMediaError(null);

    try {
      const thumbDataUrl = await createAvatarThumbnailDataUrl(file, 240);
      let nextFileId = entry.avatarFileId ?? null;

      if (workspaceToken) {
        const uploaded = await uploadPersonPhotoToDrive(workspaceToken, {
          personId: entry.id,
          personName: entry.name,
          kind: 'avatar',
          file,
          caption: `Profile photo for ${entry.name}`,
        });
        nextFileId = uploaded.driveFileId ?? null;
      }

      await onUpdateEntry({
        id: entry.id,
        avatarThumb: thumbDataUrl,
        avatarFileId: nextFileId,
      });
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setMediaError(err instanceof Error ? err.message : 'Could not update profile photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleConfirmRemoveAvatar = async () => {
    setIsDeletingMedia(true);
    setMediaError(null);
    try {
      if (entry.avatarFileId && workspaceToken) {
        await deleteDrivePhoto(workspaceToken, entry.avatarFileId);
      }
      await onUpdateEntry({
        id: entry.id,
        avatarFileId: null,
        avatarThumb: null,
      });
      setConfirmRemoveAvatar(false);
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setMediaError(err instanceof Error ? err.message : 'Failed to remove profile photo.');
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setMediaError('Please select valid image files.');
      return;
    }

    const remainingSlots = Math.max(0, 50 - galleryPhotos.length);
    if (remainingSlots === 0) {
      setMediaError('This person already has the maximum of 50 gallery photos.');
      return;
    }

    setIsUploadingGallery(true);
    setMediaError(null);

    try {
      const uploadedItems: PersonPhotoItem[] = [];
      for (const file of imageFiles.slice(0, remainingSlots)) {
        if (workspaceToken) {
          const [uploaded, localPreview] = await Promise.all([
            uploadPersonPhotoToDrive(workspaceToken, {
              personId: entry.id,
              personName: entry.name,
              kind: 'gallery',
              file,
            }),
            createCompactLocalPreviewUrl(file, 640).catch(() => undefined),
          ]);
          uploadedItems.push({
            ...uploaded,
            localDataUrl: localPreview,
          });
        } else {
          const localPreview = await createCompactLocalPreviewUrl(file, 900);
          uploadedItems.push({
            id: crypto.randomUUID(),
            driveFileId: undefined,
            name: file.name.slice(0, 160),
            mimeType: 'image/jpeg',
            createdAt: new Date().toISOString(),
            localDataUrl: localPreview,
          });
        }
      }

      await onUpdateEntry({
        id: entry.id,
        galleryPhotos: [...uploadedItems, ...galleryPhotos].slice(0, 50),
      });
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setMediaError(err instanceof Error ? err.message : 'Failed to save gallery photos.');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleConfirmDeleteGalleryPhoto = async () => {
    if (!confirmDeletePhoto) return;
    setIsDeletingMedia(true);
    setMediaError(null);
    try {
      if (confirmDeletePhoto.driveFileId && workspaceToken) {
        await deleteDrivePhoto(workspaceToken, confirmDeletePhoto.driveFileId);
      }
      const nextPhotos = galleryPhotos.filter((p) => p.id !== confirmDeletePhoto.id);
      await onUpdateEntry({
        id: entry.id,
        galleryPhotos: nextPhotos,
      });
      setConfirmDeletePhoto(null);
      setLightboxIndex(null);
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setMediaError(err instanceof Error ? err.message : 'Failed to delete photo from Google Drive.');
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const handleConfirmDeletePerson = async () => {
    setIsDeletingEntry(true);
    try {
      await onDeletePerson(entry.id);
      onBack();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to delete entry.');
      setIsDeletingEntry(false);
    }
  };

  const activeLightboxPhoto =
    lightboxIndex !== null && galleryPhotos[lightboxIndex] ? galleryPhotos[lightboxIndex] : null;

  const cleanPhoneHref = phone.trim().replace(/[^\d+]/g, '');

  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#09090B] text-neutral-950 dark:text-neutral-50 flex flex-col">
      {/* Sticky Full-Page Navigation Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#09090B]/95 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-neutral-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <nav
              aria-label="Breadcrumb"
              className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 min-w-0"
            >
              <button
                type="button"
                onClick={onBack}
                className="hover:text-neutral-950 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                People
              </button>
              <span aria-hidden="true">/</span>
              <span className="whitespace-nowrap">{entry.group}</span>
              <span aria-hidden="true">/</span>
              <span className="text-neutral-950 dark:text-white font-medium truncate max-w-[220px]">
                {entry.name}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {prevPerson && nextPerson && (
              <div className="hidden md:inline-flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-950">
                <button
                  type="button"
                  onClick={() => onSelectPerson(prevPerson)}
                  title={`Previous: ${prevPerson.name}`}
                  aria-label={`Previous person: ${prevPerson.name}`}
                  className="px-2.5 py-1.5 min-h-[36px] text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 inline-flex items-center gap-1 cursor-pointer border-r border-neutral-200 dark:border-neutral-800"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <span className="px-2.5 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                  {currentIndex + 1}/{peopleList.length}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectPerson(nextPerson)}
                  title={`Next: ${nextPerson.name}`}
                  aria-label={`Next person: ${nextPerson.name}`}
                  className="px-2.5 py-1.5 min-h-[36px] text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 inline-flex items-center gap-1 cursor-pointer border-l border-neutral-200 dark:border-neutral-800"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 inline-flex items-center justify-center text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onEditCore(entry)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Date
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeletePerson(true)}
              aria-label={`Delete ${entry.name}`}
              title={`Delete ${entry.name}`}
              className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-rose-500/40 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Page Content */}
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
          {confirmDeletePerson && (
            <div
              role="alertdialog"
              aria-label={`Confirm delete ${entry.name}`}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <p className="text-xs text-rose-700 dark:text-rose-200">
                Permanently remove <span className="font-semibold">{entry.name}</span> from your
                birthday vault?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isDeletingEntry}
                  onClick={() => setConfirmDeletePerson(false)}
                  className="px-3 py-1.5 min-h-[36px] rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingEntry}
                  onClick={handleConfirmDeletePerson}
                  className="px-3.5 py-1.5 min-h-[36px] rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeletingEntry && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Delete Person
                </button>
              </div>
            </div>
          )}

          {/* Person Identity & Countdown Hero Band */}
          <section className="pb-8 border-b border-neutral-200 dark:border-neutral-800 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
                {/* Avatar */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                  <DrivePhoto
                    driveFileId={entry.avatarFileId}
                    fallbackUrl={entry.avatarThumb}
                    workspaceToken={workspaceToken}
                    alt={entry.name}
                    onAuthExpired={onAuthExpired}
                    fallback={
                      <span className="font-display text-2xl sm:text-3xl font-medium text-neutral-700 dark:text-neutral-200">
                        {getInitials(entry.name)}
                      </span>
                    }
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Title & Unboxed Metadata */}
                <div className="min-w-0 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{entry.group} Circle</span>
                    {entry.relation && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                          {entry.relation}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>Reminder: {formatAdvanceLabel(entry.advanceDays)}</span>
                  </div>

                  <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-neutral-950 dark:text-white break-words">
                    {entry.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-neutral-600 dark:text-neutral-300 tabular-nums">
                    <span className="font-medium text-neutral-950 dark:text-white">
                      {formatShortDate(entry.month, entry.day)}
                      {entry.birthYear ? `, ${entry.birthYear}` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-xs sm:text-sm">
                      {formatCountdownLabel(entry.daysUntil)}
                    </span>
                    {entry.turningAge !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-xs sm:text-sm">
                          {isRemembrance
                            ? `${entry.turningAge} yrs in memory`
                            : `Turning ${entry.turningAge}`}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Avatar Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {entry.avatarThumb || entry.avatarFileId ? 'Change Photo' : 'Upload Photo'}
                    </button>

                    {(entry.avatarThumb || entry.avatarFileId) && !confirmRemoveAvatar && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveAvatar(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Photo
                      </button>
                    )}

                    {!workspaceToken && (
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Saved locally ·{' '}
                        <button
                          type="button"
                          onClick={() => void onSignIn()}
                          className="text-neutral-950 dark:text-white underline underline-offset-2 font-medium cursor-pointer"
                        >
                          connect Google Drive
                        </button>{' '}
                        for full-res backup
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Page Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {cleanPhoneHref && (
                  <a
                    href={`tel:${cleanPhoneHref}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                )}
                {email.trim() && (
                  <a
                    href={`mailto:${encodeURIComponent(email.trim())}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyWish}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {wishCopied ? 'Wish Copied' : 'Copy Wish'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCelebrated(entry)}
                  className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                    entry.isCelebratedThisYear
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                      : 'border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {isRemembrance
                    ? entry.isCelebratedThisYear
                      ? 'Remembered'
                      : 'Mark Remembered'
                    : entry.isCelebratedThisYear
                    ? 'Wish Recorded'
                    : 'Mark Wish Sent'}
                </button>
              </div>
            </div>

            {confirmRemoveAvatar && (
              <div
                role="alertdialog"
                aria-label="Confirm remove profile photo"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <p className="text-xs text-rose-700 dark:text-rose-200">
                  {entry.avatarFileId && workspaceToken
                    ? `Remove ${entry.name}'s profile photo and delete the file from Google Drive?`
                    : `Remove ${entry.name}'s profile photo?`}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isDeletingMedia}
                    onClick={() => setConfirmRemoveAvatar(false)}
                    className="px-3 py-1.5 min-h-[34px] rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingMedia}
                    onClick={handleConfirmRemoveAvatar}
                    className="px-3 py-1.5 min-h-[34px] rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDeletingMedia && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm Remove
                  </button>
                </div>
              </div>
            )}

            {/* Annual Cycle Countdown Bar */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                <span>
                  {entry.isToday
                    ? 'Birthday today — 100% of annual cycle'
                    : `${cycleStats.remainingDays} ${
                        cycleStats.remainingDays === 1 ? 'day' : 'days'
                      } remaining · ${cycleStats.percentComplete}% of year elapsed`}
                </span>
                <span>
                  {formatShortDate(entry.month, entry.day)}, {entry.nextOccurrenceYear}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={cycleStats.percentComplete}
                aria-label={`Annual countdown progress for ${entry.name}`}
                className="relative h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-neutral-950 dark:bg-white transition-all duration-300"
                  style={{width: `${Math.max(2, cycleStats.percentComplete)}%`}}
                />
              </div>
            </div>
          </section>

          {mediaError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300"
            >
              {mediaError}
            </div>
          )}

          {/* Two-Column Content Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left Column: Editable Details & Year History */}
            <div className="lg:col-span-5 space-y-8">
              <form onSubmit={handleSaveProfileDetails} className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="font-display text-lg font-medium text-neutral-950 dark:text-white">
                    Profile Details
                  </h2>
                  {profileSavedNotice && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-950 dark:text-white">
                      <UserCheck className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="profile-relation"
                      className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      Relation / Tag
                    </label>
                    <input
                      id="profile-relation"
                      type="text"
                      maxLength={60}
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                      placeholder="e.g., Sister, Childhood Friend"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-phone"
                      className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="profile-phone"
                        type="tel"
                        maxLength={40}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 0100"
                        className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="profile-email"
                        type="email"
                        maxLength={160}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-favorites"
                      className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      {isRemembrance ? 'Cherished Memories' : 'Favorite Things / Gift Ideas'}
                    </label>
                    <div className="relative">
                      <Heart className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="profile-favorites"
                        type="text"
                        maxLength={280}
                        value={favoriteThings}
                        onChange={(e) => setFavoriteThings(e.target.value)}
                        placeholder={
                          isRemembrance
                            ? 'Favorite song, flowers, shared tradition...'
                            : 'Filter coffee, ceramic mugs, gardening...'
                        }
                        className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-note"
                      className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      Personal Note
                    </label>
                    <textarea
                      id="profile-note"
                      rows={3}
                      maxLength={280}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a personal reminder or note..."
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                    />
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-2 min-h-[40px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Profile
                  </button>
                </div>
              </form>

              {/* Annual Celebration History */}
              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <h2 className="font-display text-lg font-medium text-neutral-950 dark:text-white">
                  Year History
                </h2>
                {sortedCelebratedYears.length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    No wishes recorded yet. Each year&apos;s wish status resets automatically once
                    the next birthday cycle starts while preserving past years here.
                  </p>
                ) : (
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 font-mono tabular-nums leading-relaxed">
                    Recorded years: {sortedCelebratedYears.join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Personal Photo Gallery */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h2 className="font-display text-lg font-medium text-neutral-950 dark:text-white">
                    Photo Gallery ({galleryPhotos.length})
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {workspaceToken
                      ? 'Stored privately in your Google Drive folder “Broll Photos”.'
                      : 'Stored locally in your browser vault (connect Google Drive for cloud backup).'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingGallery}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingGallery ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    {isUploadingGallery ? 'Saving...' : 'Add Photos'}
                  </button>
                  {!workspaceToken && (
                    <button
                      type="button"
                      onClick={() => void onSignIn()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium cursor-pointer"
                    >
                      Connect Google Drive
                    </button>
                  )}
                </div>
              </div>

              {confirmDeletePhoto && (
                <div
                  role="alertdialog"
                  aria-label="Confirm delete gallery photo"
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <p className="text-xs text-rose-700 dark:text-rose-200">
                    Delete “{confirmDeletePhoto.name}” from Google Drive and {entry.name}&apos;s
                    gallery? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isDeletingMedia}
                      onClick={() => setConfirmDeletePhoto(null)}
                      className="px-3 py-1.5 min-h-[34px] rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingMedia}
                      onClick={handleConfirmDeleteGalleryPhoto}
                      className="px-3 py-1.5 min-h-[34px] rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {isDeletingMedia && <Loader2 className="w-3 h-3 animate-spin" />}
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}

              {galleryPhotos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-14 px-6 text-center space-y-3">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    No photos added for {entry.name} yet.
                  </p>
                  <button
                    type="button"
                    disabled={isUploadingGallery}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    Upload First Photo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {galleryPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900"
                    >
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className="w-full h-full block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                      >
                        <DrivePhoto
                          driveFileId={photo.driveFileId}
                          fallbackUrl={photo.localDataUrl}
                          workspaceToken={workspaceToken}
                          alt={photo.caption || photo.name}
                          onAuthExpired={onAuthExpired}
                          fallback={
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-[11px] text-neutral-500 dark:text-neutral-400">
                              <span>Google Drive Photo</span>
                              <span className="mt-0.5 truncate max-w-full">{photo.name}</span>
                            </div>
                          }
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePhoto(photo)}
                        aria-label={`Delete ${photo.name}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-2 right-2 w-7 h-7 rounded-md bg-black/75 text-white inline-flex items-center justify-center hover:bg-rose-600 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Prev/Next Strip */}
          {prevPerson && nextPerson && (
            <div className="md:hidden pt-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelectPerson(prevPerson)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[46%] cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{prevPerson.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectPerson(nextPerson)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[46%] cursor-pointer"
              >
                <span className="truncate">{nextPerson.name}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Overlay */}
      {activeLightboxPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="max-w-4xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white text-xs">
              <span className="truncate font-medium">
                {entry.name} — {activeLightboxPhoto.caption || activeLightboxPhoto.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePhoto(activeLightboxPhoto)}
                  className="px-3 py-1.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close photo preview"
                  className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full max-h-[80vh] flex items-center justify-center bg-black rounded-lg border border-neutral-800 overflow-hidden">
              <DrivePhoto
                driveFileId={activeLightboxPhoto.driveFileId}
                fallbackUrl={activeLightboxPhoto.localDataUrl}
                workspaceToken={workspaceToken}
                alt={activeLightboxPhoto.caption || activeLightboxPhoto.name}
                onAuthExpired={onAuthExpired}
                className="max-h-[80vh] w-auto object-contain"
              />
              {galleryPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length
                      )
                    }
                    aria-label="Previous photo"
                    className="absolute left-3 w-10 h-10 rounded-md bg-black/70 hover:bg-black text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % galleryPhotos.length)}
                    aria-label="Next photo"
                    className="absolute right-3 w-10 h-10 rounded-md bg-black/70 hover:bg-black text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
