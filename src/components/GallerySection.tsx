import React, {useMemo, useRef, useState} from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ImagePlus,
  Images,
  Loader2,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type {
  BirthdayEntry,
  ComputedBirthday,
  PersonPhotoItem,
  RelationshipGroup,
} from '../types/birthday';
import {formatShortDate} from '../utils/dateMath';
import {
  createCompactLocalPreviewUrl,
  deleteDrivePhoto,
  uploadPersonPhotoToDrive,
} from '../utils/googleDriveMedia';
import {WorkspaceAuthError} from '../utils/googleSheets';
import {DrivePhoto} from './DrivePhoto';

interface GallerySectionProps {
  birthdays: ComputedBirthday[];
  workspaceToken: string | null;
  onSignIn: () => Promise<void>;
  onAuthExpired: () => void;
  onOpenProfile: (entry: ComputedBirthday) => void;
  onUpdateEntry: (updatedFields: Partial<BirthdayEntry> & {id: string}) => Promise<void> | void;
}

interface GalleryItemView {
  entry: ComputedBirthday;
  photo: PersonPhotoItem;
  isAvatar: boolean;
}

const CIRCLE_TABS: ('All' | RelationshipGroup)[] = ['All', 'Family', 'Friends', 'Remembrance'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  birthdays,
  workspaceToken,
  onSignIn,
  onAuthExpired,
  onOpenProfile,
  onUpdateEntry,
}) => {
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState<'All' | RelationshipGroup>('All');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('All');
  const [uploadPersonId, setUploadPersonId] = useState<string>('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<GalleryItemView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [editingCaptionKey, setEditingCaptionKey] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedPeople = useMemo(
    () => [...birthdays].sort((a, b) => a.name.localeCompare(b.name)),
    [birthdays]
  );

  const effectiveUploadPersonId = useMemo(() => {
    if (uploadPersonId && birthdays.some((b) => b.id === uploadPersonId)) {
      return uploadPersonId;
    }
    if (selectedPersonId !== 'All' && birthdays.some((b) => b.id === selectedPersonId)) {
      return selectedPersonId;
    }
    return sortedPeople[0]?.id ?? '';
  }, [uploadPersonId, selectedPersonId, birthdays, sortedPeople]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedPeople.filter((person) => {
      if (circleFilter !== 'All' && person.group !== circleFilter) return false;
      if (!q) return true;
      return (
        person.name.toLowerCase().includes(q) ||
        (person.relation ?? '').toLowerCase().includes(q) ||
        person.note.toLowerCase().includes(q)
      );
    });
  }, [sortedPeople, circleFilter, search]);

  const allPhotos = useMemo<GalleryItemView[]>(() => {
    const items: GalleryItemView[] = [];
    const q = search.trim().toLowerCase();

    for (const entry of birthdays) {
      if (circleFilter !== 'All' && entry.group !== circleFilter) continue;
      if (selectedPersonId !== 'All' && entry.id !== selectedPersonId) continue;

      if (entry.avatarThumb || entry.avatarFileId) {
        const avatarItem: GalleryItemView = {
          entry,
          isAvatar: true,
          photo: {
            id: `avatar-${entry.id}`,
            driveFileId: entry.avatarFileId ?? undefined,
            name: `${entry.name} Profile Photo`,
            mimeType: 'image/jpeg',
            caption: 'Profile Portrait',
            createdAt: entry.updatedAt,
            localDataUrl: entry.avatarThumb ?? undefined,
          },
        };
        if (
          !q ||
          entry.name.toLowerCase().includes(q) ||
          (avatarItem.photo.caption ?? '').toLowerCase().includes(q)
        ) {
          items.push(avatarItem);
        }
      }

      for (const photo of entry.galleryPhotos ?? []) {
        if (
          !q ||
          entry.name.toLowerCase().includes(q) ||
          photo.name.toLowerCase().includes(q) ||
          (photo.caption ?? '').toLowerCase().includes(q)
        ) {
          items.push({entry, photo, isAvatar: false});
        }
      }
    }

    return items.sort((a, b) => {
      const timeA = Date.parse(a.photo.createdAt) || 0;
      const timeB = Date.parse(b.photo.createdAt) || 0;
      return timeB - timeA;
    });
  }, [birthdays, circleFilter, selectedPersonId, search]);

  const totalPhotoCount = useMemo(() => {
    let count = 0;
    for (const entry of birthdays) {
      if (entry.avatarThumb || entry.avatarFileId) count += 1;
      count += entry.galleryPhotos?.length ?? 0;
    }
    return count;
  }, [birthdays]);

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const targetPerson = birthdays.find((b) => b.id === effectiveUploadPersonId);
    if (!targetPerson) {
      setErrorMsg('Please select a person before uploading photos.');
      return;
    }

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setErrorMsg('Please select valid image files (JPG, PNG, or WebP).');
      return;
    }

    const existing = targetPerson.galleryPhotos ?? [];
    const remainingSlots = Math.max(0, 50 - existing.length);
    if (remainingSlots === 0) {
      setErrorMsg(`${targetPerson.name} already has 50 gallery photos.`);
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const uploadedList: PersonPhotoItem[] = [];
      for (const file of imageFiles.slice(0, remainingSlots)) {
        if (workspaceToken) {
          const [uploaded, localPreview] = await Promise.all([
            uploadPersonPhotoToDrive(workspaceToken, {
              personId: targetPerson.id,
              personName: targetPerson.name,
              kind: 'gallery',
              file,
              caption: uploadCaption.trim() || undefined,
            }),
            createCompactLocalPreviewUrl(file, 640).catch(() => undefined),
          ]);
          uploadedList.push({...uploaded, localDataUrl: localPreview});
        } else {
          const localPreview = await createCompactLocalPreviewUrl(file, 900);
          uploadedList.push({
            id: crypto.randomUUID(),
            driveFileId: undefined,
            name: file.name.slice(0, 160),
            mimeType: 'image/jpeg',
            caption: uploadCaption.trim().slice(0, 200) || undefined,
            createdAt: new Date().toISOString(),
            localDataUrl: localPreview,
          });
        }
      }

      await onUpdateEntry({
        id: targetPerson.id,
        galleryPhotos: [...uploadedList, ...existing].slice(0, 50),
      });
      setUploadCaption('');
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save selected photos.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      if (pendingDelete.photo.driveFileId && workspaceToken) {
        await deleteDrivePhoto(workspaceToken, pendingDelete.photo.driveFileId);
      }
      if (pendingDelete.isAvatar) {
        await onUpdateEntry({
          id: pendingDelete.entry.id,
          avatarFileId: null,
          avatarThumb: null,
        });
      } else {
        const nextPhotos = (pendingDelete.entry.galleryPhotos ?? []).filter(
          (p) => p.id !== pendingDelete.photo.id
        );
        await onUpdateEntry({
          id: pendingDelete.entry.id,
          galleryPhotos: nextPhotos,
        });
      }
      setPendingDelete(null);
      setLightboxIdx(null);
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onAuthExpired();
      }
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete photo from Google Drive.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveCaption = async (item: GalleryItemView) => {
    if (item.isAvatar) {
      setEditingCaptionKey(null);
      return;
    }
    const nextPhotos = (item.entry.galleryPhotos ?? []).map((p) =>
      p.id === item.photo.id ? {...p, caption: captionDraft.trim() || undefined} : p
    );
    await onUpdateEntry({
      id: item.entry.id,
      galleryPhotos: nextPhotos,
    });
    setEditingCaptionKey(null);
  };

  const activeLightbox =
    lightboxIdx !== null && allPhotos[lightboxIdx] ? allPhotos[lightboxIdx] : null;

  return (
    <div className="space-y-6">
      {/* Header & Google Drive Upload Bar */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Images className="w-5 h-5 text-neutral-950 dark:text-white" />
              <h2 className="font-display text-xl font-medium text-neutral-950 dark:text-white">
                People & Photo Gallery
              </h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {birthdays.length} profiles · {totalPhotoCount}{' '}
              {totalPhotoCount === 1 ? 'photo' : 'photos'} ·{' '}
              {workspaceToken
                ? 'Synced with Google Drive (“Broll Photos”)'
                : 'Stored locally in browser vault (optional Google Drive backup)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {workspaceToken ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-950 dark:text-white">
                <FolderOpen className="w-4 h-4" />
                Google Drive Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onSignIn()}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-950 dark:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* Upload Bar */}
        {birthdays.length > 0 && (
          <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="sr-only">Choose person to upload photo for</span>
                <select
                  value={effectiveUploadPersonId}
                  onChange={(e) => setUploadPersonId(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
                >
                  {sortedPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatShortDate(p.month, p.day)})
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="text"
                maxLength={200}
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Optional photo caption or memory..."
                className="w-full min-h-[38px] px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUploadFiles}
              className="hidden"
            />

            <button
              type="button"
              disabled={isUploading || !effectiveUploadPersonId}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              {isUploading
                ? 'Saving Photos...'
                : workspaceToken
                ? 'Upload Photos to Drive'
                : 'Add Photos Locally'}
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
              className="p-1 rounded hover:bg-rose-500/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Filter & Search Bar */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative w-full lg:max-w-xs">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or captions..."
              aria-label="Search gallery"
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="tablist"
              aria-label="Filter gallery by circle"
              className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto"
            >
              {CIRCLE_TABS.map((tab) => {
                const active = circleFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCircleFilter(tab)}
                    className={`px-3 py-1 min-h-[30px] rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <select
              aria-label="Filter gallery by person"
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 cursor-pointer"
            >
              <option value="All">All People ({birthdays.length})</option>
              {sortedPeople.map((p) => {
                const count =
                  (p.galleryPhotos?.length ?? 0) + (p.avatarThumb || p.avatarFileId ? 1 : 0);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Profiles Strip */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              People Profiles ({filteredPeople.length})
            </h3>
            {selectedPersonId !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedPersonId('All')}
                className="text-xs text-neutral-950 dark:text-white underline underline-offset-2 cursor-pointer"
              >
                Show all people
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredPeople.map((person) => {
              const photoCount =
                (person.galleryPhotos?.length ?? 0) +
                (person.avatarThumb || person.avatarFileId ? 1 : 0);
              const isSelected = selectedPersonId === person.id;

              return (
                <div
                  key={person.id}
                  className={`rounded-lg border p-3 flex flex-col justify-between gap-2.5 transition-colors ${
                    isSelected
                      ? 'border-neutral-950 dark:border-white bg-neutral-100 dark:bg-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPersonId((prev) => (prev === person.id ? 'All' : person.id))
                    }
                    className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-center shrink-0">
                      <DrivePhoto
                        driveFileId={person.avatarFileId}
                        fallbackUrl={person.avatarThumb}
                        workspaceToken={workspaceToken}
                        alt={person.name}
                        onAuthExpired={onAuthExpired}
                        fallback={
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                            {getInitials(person.name)}
                          </span>
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-950 dark:text-white truncate">
                        {person.name}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate tabular-nums">
                        {formatShortDate(person.month, person.day)} · {photoCount}{' '}
                        {photoCount === 1 ? 'photo' : 'photos'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenProfile(person)}
                    className="w-full py-1.5 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <User className="w-3 h-3" />
                    Open Profile
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm Drive Photo Delete */}
        {pendingDelete && (
          <div
            role="alertdialog"
            aria-label="Confirm delete photo"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <p className="text-xs text-rose-700 dark:text-rose-200">
              Delete “{pendingDelete.photo.name}” for {pendingDelete.entry.name}?
              {pendingDelete.photo.driveFileId && workspaceToken
                ? ' This will permanently delete the file from Google Drive.'
                : ''}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 min-h-[34px] rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 min-h-[34px] rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Photos Grid */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3">
            Gallery Photos ({allPhotos.length})
          </h3>

          {allPhotos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 py-12 px-6 text-center">
              <p className="text-sm font-medium text-neutral-950 dark:text-white">
                No photos in this gallery yet
              </p>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                Pick a person above and upload photos, or open any profile to add a portrait and
                memories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allPhotos.map((item, idx) => {
                const key = `${item.entry.id}-${item.photo.id}`;
                const isEditingCaption = editingCaptionKey === key;

                return (
                  <div
                    key={key}
                    className="group rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setLightboxIdx(idx)}
                        className="w-full h-full block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                      >
                        <DrivePhoto
                          driveFileId={item.photo.driveFileId}
                          fallbackUrl={item.photo.localDataUrl}
                          workspaceToken={workspaceToken}
                          alt={`${item.entry.name} — ${item.photo.caption || item.photo.name}`}
                          onAuthExpired={onAuthExpired}
                          fallback={
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
                              <Images className="w-5 h-5 mb-1.5 opacity-60" />
                              <span className="truncate max-w-full font-medium">
                                {item.entry.name}
                              </span>
                              {!workspaceToken && item.photo.driveFileId && (
                                <span className="text-[10px] mt-1">Sign in to view Drive photo</span>
                              )}
                            </div>
                          }
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label={`Delete ${item.photo.name}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-2 right-2 w-7 h-7 rounded-md bg-black/75 text-white inline-flex items-center justify-center hover:bg-rose-600 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(item.entry)}
                          className="text-xs font-semibold text-neutral-950 dark:text-white hover:underline underline-offset-2 truncate cursor-pointer"
                        >
                          {item.entry.name}
                        </button>
                        <span className="text-[11px] font-mono tabular-nums text-neutral-400 dark:text-neutral-500 shrink-0">
                          {formatShortDate(item.entry.month, item.entry.day)}
                        </span>
                      </div>

                      {isEditingCaption ? (
                        <div className="flex items-center gap-1 pt-1">
                          <input
                            type="text"
                            maxLength={200}
                            value={captionDraft}
                            onChange={(e) => setCaptionDraft(e.target.value)}
                            placeholder="Caption..."
                            className="flex-1 min-w-0 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[11px] text-neutral-950 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveCaption(item)}
                            className="px-2 py-1 rounded bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-[11px] font-medium cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            {item.photo.caption || (item.isAvatar ? 'Profile Portrait' : item.entry.group)}
                          </p>
                          {!item.isAvatar && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCaptionKey(key);
                                setCaptionDraft(item.photo.caption ?? '');
                              }}
                              className="text-[11px] text-neutral-400 hover:text-neutral-950 dark:hover:text-white shrink-0 cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Viewer */}
      {activeLightbox && lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="max-w-4xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex flex-wrap items-center justify-between gap-3 text-white text-xs">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIdx(null);
                    onOpenProfile(activeLightbox.entry);
                  }}
                  className="font-semibold hover:underline cursor-pointer"
                >
                  {activeLightbox.entry.name}
                </button>
                <span className="mx-2 text-white/40">·</span>
                <span className="text-white/80">
                  {activeLightbox.photo.caption || activeLightbox.photo.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingDelete(activeLightbox)}
                  className="px-3 py-1.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIdx(null)}
                  aria-label="Close lightbox"
                  className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full max-h-[78vh] flex items-center justify-center bg-black rounded-lg border border-neutral-800 overflow-hidden">
              <DrivePhoto
                driveFileId={activeLightbox.photo.driveFileId}
                fallbackUrl={activeLightbox.photo.localDataUrl}
                workspaceToken={workspaceToken}
                alt={activeLightbox.photo.caption || activeLightbox.photo.name}
                onAuthExpired={onAuthExpired}
                className="max-h-[78vh] w-auto object-contain"
              />
              {allPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((lightboxIdx - 1 + allPhotos.length) % allPhotos.length)
                    }
                    aria-label="Previous photo"
                    className="absolute left-3 w-10 h-10 rounded-md bg-black/70 hover:bg-black text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % allPhotos.length)}
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
