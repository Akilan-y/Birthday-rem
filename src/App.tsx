/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Bell,
  Cloud,
  Leaf,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import {BirthdayFormModal} from './components/BirthdayFormModal';
import {CalendarWorkspace} from './components/CalendarWorkspace';
import {ChatbotPanel} from './components/ChatbotPanel';
import {GallerySection} from './components/GallerySection';
import {GoogleSheetsPanel} from './components/GoogleSheetsPanel';
import {MobileBottomNav} from './components/MobileBottomNav';
import {MonthCalendarGrid} from './components/MonthCalendarGrid';
import {PersonProfilePage} from './components/PersonProfilePage';
import {PrivacyVaultPanel} from './components/PrivacyVaultPanel';
import {RemindersPanel} from './components/RemindersPanel';
import {SideRail} from './components/SideRail';
import {SpotlightHero} from './components/SpotlightHero';
import {StatisticsSection} from './components/StatisticsSection';
import {UpcomingList} from './components/UpcomingList';
import {useFirebase} from './contexts/FirebaseContext';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {useSheetsParallelSync} from './hooks/useSheetsParallelSync';
import type {
  AdvanceNoticeDays,
  BirthdayEntry,
  ChatMessageEntry,
  ComputedBirthday,
  NotificationLogItem,
  NotificationSettings,
  RelationshipGroup,
  SortMode,
  UpcomingFilter,
  WorkspaceView,
} from './types/birthday';
import {computeBirthday} from './utils/dateMath';
import {
  canonicalEntrySignature,
  normalizeNameKey,
} from './utils/googleSheets';
import {
  bulkDeleteBirthdaysInFirestore,
  bulkReassignBirthdaysInFirestore,
  clearChatMessagesInFirestore,
  createBirthdayInFirestore,
  deleteBirthdayInFirestore,
  saveChatMessageToFirestore,
  subscribeToBirthdaysInFirestore,
  subscribeToChatMessagesInFirestore,
  subscribeToUserProfile,
  syncBirthdaysBatchToFirestore,
  updateBirthdayInFirestore,
  updateUserNotificationSettingsInFirestore,
} from './utils/firestoreVault';
import {evaluateAndSendDueReminders} from './utils/localNotifications';
import {
  calculateVaultBytes,
  DEFAULT_NOTIFICATION_SETTINGS,
  isSampleBirthdayId,
  loadChatMessagesFromVault,
  loadVaultData,
  saveBirthdaysToVault,
  saveChatMessagesToVault,
  saveLogsToVault,
  saveSettingsToVault,
} from './utils/localStorageVault';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function preserveLocalGalleryPreviews(
  remoteEntries: BirthdayEntry[],
  localEntries: BirthdayEntry[]
): BirthdayEntry[] {
  const localById = new Map(localEntries.map((entry) => [entry.id, entry]));
  return remoteEntries.map((remote) => {
    const local = localById.get(remote.id);
    if (!local || !remote.galleryPhotos || remote.galleryPhotos.length === 0) {
      return remote;
    }
    const localPhotosById = new Map(
      (local.galleryPhotos ?? []).map((photo) => [photo.id, photo])
    );
    return {
      ...remote,
      galleryPhotos: remote.galleryPhotos.map((photo) => {
        const localPhoto = localPhotosById.get(photo.id);
        return localPhoto?.localDataUrl && !photo.localDataUrl
          ? {...photo, localDataUrl: localPhoto.localDataUrl}
          : photo;
      }),
    };
  });
}

export default function App() {
  const isOnline = useOnlineStatus();
  const {
    user,
    authReady,
    profileReady,
    authError,
    workspaceToken,
    invalidateWorkspaceToken,
    signIn,
    connectWorkspace,
    clearAuthError,
    signOut,
  } = useFirebase();
  const isCloudSynced = Boolean(user && profileReady);

  const [isLoaded, setIsLoaded] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageEntry[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<WorkspaceView>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<UpcomingFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('soonest');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BirthdayEntry | null>(null);
  const [profileEntryId, setProfileEntryId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.hash.match(/^#person\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const [modalInitialMonth, setModalInitialMonth] = useState<number | undefined>(undefined);
  const [modalInitialDay, setModalInitialDay] = useState<number | undefined>(undefined);

  const openPersonPage = useCallback((id: string) => {
    setProfileEntryId(id);
    if (typeof window !== 'undefined') {
      const targetHash = `#person/${encodeURIComponent(id)}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
    }
  }, []);

  const closePersonPage = useCallback(() => {
    setProfileEntryId(null);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#person/')) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    const handleHashOrPop = () => {
      const match = window.location.hash.match(/^#person\/(.+)$/);
      setProfileEntryId(match ? decodeURIComponent(match[1]) : null);
    };
    window.addEventListener('hashchange', handleHashOrPop);
    window.addEventListener('popstate', handleHashOrPop);
    return () => {
      window.removeEventListener('hashchange', handleHashOrPop);
      window.removeEventListener('popstate', handleHashOrPop);
    };
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );

  const birthdaysRef = useRef<BirthdayEntry[]>([]);
  birthdaysRef.current = birthdays;
  const mergedUidRef = useRef<string | null>(null);

  const handleApplySheetEntries = useCallback(
    async (nextEntries: BirthdayEntry[]) => {
      const prevEntries = birthdaysRef.current;
      const prevMap = new Map(prevEntries.map((item) => [item.id, item]));
      const nextIdSet = new Set(nextEntries.map((item) => item.id));

      const removedIds = prevEntries
        .filter((item) => !nextIdSet.has(item.id))
        .map((item) => item.id);
      const upserted = nextEntries.filter((item) => {
        const prev = prevMap.get(item.id);
        return !prev || canonicalEntrySignature(prev) !== canonicalEntrySignature(item);
      });

      setBirthdays(nextEntries);
      await saveBirthdaysToVault(nextEntries);

      if (user && profileReady) {
        try {
          if (removedIds.length > 0) {
            await bulkDeleteBirthdaysInFirestore(user.uid, removedIds);
          }
          if (upserted.length > 0) {
            await syncBirthdaysBatchToFirestore(user.uid, upserted);
          }
        } catch (err) {
          setFirestoreError(
            err instanceof Error ? err.message : 'Unable to sync sheet changes to cloud.'
          );
        }
      }
    },
    [user, profileReady]
  );

  const sheetsSync = useSheetsParallelSync({
    isLoaded,
    birthdays,
    workspaceToken,
    onApplySheetEntries: handleApplySheetEntries,
    onAuthExpired: invalidateWorkspaceToken,
  });

  useEffect(() => {
    let active = true;
    Promise.all([loadVaultData(), loadChatMessagesFromVault()]).then(
      async ([data, localChats]) => {
        if (!active) return;
        setBirthdays(data.birthdays);
        setSettings(data.settings);
        setLogs(data.logs);
        setChatMessages(localChats);
        setIsLoaded(true);
      }
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time Firestore subscriptions once authenticated & profile verified
  useEffect(() => {
    if (!isLoaded) return;
    if (!user || !profileReady) {
      mergedUidRef.current = null;
      return;
    }

    const uid = user.uid;
    setFirestoreError(null);

    const unsubProfile = subscribeToUserProfile(
      uid,
      (partial) => {
        setSettings((prev) => {
          const next = {...prev, ...partial};
          void saveSettingsToVault(next);
          return next;
        });
      },
      (err) => setFirestoreError(err.message)
    );

    const unsubBirthdays = subscribeToBirthdaysInFirestore(
      uid,
      (remoteEntries) => {
        const sampleIds = remoteEntries
          .filter((item) => isSampleBirthdayId(item.id))
          .map((item) => item.id);
        const cleanedRemote = preserveLocalGalleryPreviews(
          remoteEntries.filter((item) => !isSampleBirthdayId(item.id)),
          birthdaysRef.current
        );

        if (sampleIds.length > 0) {
          void bulkDeleteBirthdaysInFirestore(uid, sampleIds).catch((err) => {
            setFirestoreError(
              err instanceof Error ? err.message : 'Unable to remove sample birthdays from cloud.'
            );
          });
        }

        if (mergedUidRef.current !== uid) {
          mergedUidRef.current = uid;
          const seedFlagKey = `broll_cloud_seeded_${uid}`;
          const remoteIds = new Set(cleanedRemote.map((item) => item.id));
          const remoteNameDates = new Set(
            cleanedRemote.map(
              (item) => `${normalizeNameKey(item.name)}|${item.month}|${item.day}`
            )
          );
          const localAdditions = birthdaysRef.current.filter(
            (item) =>
              !isSampleBirthdayId(item.id) &&
              !remoteIds.has(item.id) &&
              !remoteNameDates.has(
                `${normalizeNameKey(item.name)}|${item.month}|${item.day}`
              )
          );

          localStorage.setItem(seedFlagKey, 'true');
          if (localAdditions.length > 0) {
            const combined = [...cleanedRemote, ...localAdditions];
            setBirthdays(combined);
            void saveBirthdaysToVault(combined);
            void syncBirthdaysBatchToFirestore(uid, localAdditions).catch((err) => {
              setFirestoreError(err instanceof Error ? err.message : 'Unable to merge local birthdays.');
            });
            return;
          }
        }

        setBirthdays(cleanedRemote);
        void saveBirthdaysToVault(cleanedRemote);
      },
      (err) => setFirestoreError(err.message)
    );

    const unsubChat = subscribeToChatMessagesInFirestore(
      uid,
      (remoteMessages) => {
        setChatMessages(remoteMessages);
        void saveChatMessagesToVault(remoteMessages);
      },
      (err) => setFirestoreError(err.message)
    );

    return () => {
      unsubProfile();
      unsubBirthdays();
      unsubChat();
    };
  }, [isLoaded, user, profileReady]);

  const computedBirthdays = useMemo<ComputedBirthday[]>(() => {
    const now = new Date();
    return birthdays
      .map((entry) => computeBirthday(entry, now))
      .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
  }, [birthdays]);

  const activeProfileEntry = useMemo(
    () => (profileEntryId ? computedBirthdays.find((b) => b.id === profileEntryId) ?? null : null),
    [computedBirthdays, profileEntryId]
  );

  const filteredBirthdays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = computedBirthdays.filter((item) => {
      if (groupFilter === 'Within 30 Days') {
        if (item.daysUntil > 30) return false;
      } else if (groupFilter !== 'All' && item.group !== groupFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.relation ?? '').toLowerCase().includes(q) ||
        (item.favoriteThings ?? '').toLowerCase().includes(q)
      );
    });

    if (sortMode === 'alphabetical') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === 'month') {
      return [...list].sort(
        (a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name)
      );
    }
    return list;
  }, [computedBirthdays, groupFilter, searchQuery, sortMode]);

  // Also allow top-bar search to filter calendar & scheduled agenda smoothly
  const searchedBirthdays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return computedBirthdays;
    return computedBirthdays.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.relation ?? '').toLowerCase().includes(q) ||
        (item.favoriteThings ?? '').toLowerCase().includes(q)
    );
  }, [computedBirthdays, searchQuery]);

  const vaultBytes = useMemo(
    () => calculateVaultBytes(birthdays, settings, logs),
    [birthdays, settings, logs]
  );

  useEffect(() => {
    if (!isLoaded || !settings.enabled) return;

    const runCheck = async () => {
      const {newNotifiedKeys, newLogs} = await evaluateAndSendDueReminders(
        computedBirthdays,
        settings
      );
      if (newNotifiedKeys.length > 0 || newLogs.length > 0) {
        const nextSettings: NotificationSettings = {
          ...settings,
          notifiedKeys: [...settings.notifiedKeys, ...newNotifiedKeys].slice(-200),
        };
        const nextLogs = [...newLogs, ...logs].slice(0, 40);
        setSettings(nextSettings);
        setLogs(nextLogs);
        await saveSettingsToVault(nextSettings);
        await saveLogsToVault(nextLogs);
      }
    };

    runCheck();
    const timer = window.setInterval(runCheck, 60_000);
    return () => window.clearInterval(timer);
  }, [isLoaded, computedBirthdays, settings, logs]);

  const handleToggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('linden_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('linden_theme', 'light');
    }
  };

  const handleOpenAddModal = (month?: number, day?: number) => {
    setEditingEntry(null);
    setModalInitialMonth(month);
    setModalInitialDay(day);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry: BirthdayEntry) => {
    setEditingEntry(entry);
    setModalInitialMonth(undefined);
    setModalInitialDay(undefined);
    setIsModalOpen(true);
  };

  const handleSaveBirthday = async (data: {
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
  }) => {
    const nowIso = new Date().toISOString();
    let updated: BirthdayEntry[];
    let targetEntry: BirthdayEntry | undefined;

    if (data.id) {
      updated = birthdays.map((item) => {
        if (item.id !== data.id) return item;
        targetEntry = {
          ...item,
          name: data.name,
          month: data.month,
          day: data.day,
          birthYear: data.birthYear,
          group: data.group,
          note: data.note,
          advanceDays: data.advanceDays,
          relation: data.relation !== undefined ? data.relation : item.relation,
          phone: data.phone !== undefined ? data.phone : item.phone,
          email: data.email !== undefined ? data.email : item.email,
          favoriteThings:
            data.favoriteThings !== undefined ? data.favoriteThings : item.favoriteThings,
          avatarThumb: data.avatarThumb !== undefined ? data.avatarThumb : item.avatarThumb,
          avatarFileId: data.avatarFileId !== undefined ? data.avatarFileId : item.avatarFileId,
          updatedAt: nowIso,
        };
        return targetEntry;
      });
    } else {
      targetEntry = {
        id: data.draftId ?? crypto.randomUUID(),
        name: data.name,
        month: data.month,
        day: data.day,
        birthYear: data.birthYear,
        group: data.group,
        note: data.note,
        advanceDays: data.advanceDays,
        celebratedYears: [],
        relation: data.relation || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        favoriteThings: data.favoriteThings || undefined,
        avatarThumb: data.avatarThumb ?? null,
        avatarFileId: data.avatarFileId ?? null,
        galleryPhotos: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updated = [...birthdays, targetEntry];
    }

    localStorage.removeItem('broll_user_cleared_all');
    setBirthdays(updated);
    await saveBirthdaysToVault(updated);

    if (user && profileReady && targetEntry) {
      try {
        if (data.id) {
          await updateBirthdayInFirestore(user.uid, targetEntry);
        } else {
          await createBirthdayInFirestore(user.uid, targetEntry);
        }
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to save to cloud.');
      }
    }
  };

  const handleUpdateProfileFields = useCallback(
    async (updatedFields: Partial<BirthdayEntry> & {id: string}) => {
      const nowIso = new Date().toISOString();
      let targetEntry: BirthdayEntry | undefined;
      const updated = birthdaysRef.current.map((item) => {
        if (item.id !== updatedFields.id) return item;
        targetEntry = {
          ...item,
          ...updatedFields,
          updatedAt: nowIso,
        };
        return targetEntry;
      });

      if (!targetEntry) return;

      setBirthdays(updated);
      await saveBirthdaysToVault(updated);

      if (user && profileReady) {
        try {
          await updateBirthdayInFirestore(user.uid, targetEntry);
        } catch (err) {
          setFirestoreError(
            err instanceof Error ? err.message : 'Unable to sync profile update to cloud.'
          );
        }
      }
    },
    [user, profileReady]
  );

  const handleDeleteBirthday = async (id: string) => {
    const updated = birthdays.filter((item) => item.id !== id);
    setBirthdays(updated);
    await saveBirthdaysToVault(updated);

    if (user && profileReady) {
      try {
        await deleteBirthdayInFirestore(user.uid, id);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to delete from cloud.');
      }
    }
  };

  const handleBulkDeleteBirthdays = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const updated = birthdays.filter((item) => !idSet.has(item.id));
    setBirthdays(updated);
    await saveBirthdaysToVault(updated);

    if (user && profileReady) {
      try {
        await bulkDeleteBirthdaysInFirestore(user.uid, ids);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to delete entries from cloud.');
      }
    }
  };

  const handleBulkReassignGroup = async (ids: string[], group: RelationshipGroup) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();
    const updated = birthdays.map((item) =>
      idSet.has(item.id)
        ? {
            ...item,
            group,
            updatedAt: nowIso,
          }
        : item
    );
    setBirthdays(updated);
    await saveBirthdaysToVault(updated);

    if (user && profileReady) {
      try {
        await bulkReassignBirthdaysInFirestore(user.uid, ids, group);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to reassign entries in cloud.');
      }
    }
  };

  const handleToggleCelebrated = async (entry: ComputedBirthday) => {
    const targetYear = entry.nextOccurrenceYear;
    let updatedEntry: BirthdayEntry | undefined;
    const updated = birthdays.map((item) => {
      if (item.id !== entry.id) return item;
      const exists = item.celebratedYears.includes(targetYear);
      updatedEntry = {
        ...item,
        celebratedYears: exists
          ? item.celebratedYears.filter((y) => y !== targetYear)
          : [...item.celebratedYears, targetYear],
        updatedAt: new Date().toISOString(),
      };
      return updatedEntry;
    });
    setBirthdays(updated);
    await saveBirthdaysToVault(updated);

    if (user && profileReady && updatedEntry) {
      try {
        await updateBirthdayInFirestore(user.uid, updatedEntry);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to update celebration status.');
      }
    }
  };

  const handleUpdateSettings = async (next: NotificationSettings) => {
    setSettings(next);
    await saveSettingsToVault(next);

    if (user && profileReady) {
      try {
        await updateUserNotificationSettingsInFirestore(user.uid, next);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to update cloud settings.');
      }
    }
  };

  const handleAppendLog = async (item: NotificationLogItem) => {
    const nextLogs = [item, ...logs].slice(0, 40);
    setLogs(nextLogs);
    await saveLogsToVault(nextLogs);
  };

  const handleClearLogs = async () => {
    setLogs([]);
    await saveLogsToVault([]);
  };

  const handleImportBirthdays = async (
    imported: BirthdayEntry[],
    importedSettings?: NotificationSettings
  ) => {
    const existingIds = new Set(birthdays.map((b) => b.id));
    const existingKeys = new Set(
      birthdays.map((b) => `${b.name.trim().toLowerCase()}|${b.month}|${b.day}`)
    );
    const additions = imported.filter((item) => {
      const key = `${item.name.trim().toLowerCase()}|${item.month}|${item.day}`;
      if (existingIds.has(item.id) || existingKeys.has(key)) return false;
      existingIds.add(item.id);
      existingKeys.add(key);
      return true;
    });
    const merged = [...birthdays, ...additions];
    if (merged.length > 0) {
      localStorage.removeItem('broll_user_cleared_all');
    }
    setBirthdays(merged);
    await saveBirthdaysToVault(merged);

    let nextSettings: NotificationSettings | undefined;
    if (importedSettings) {
      nextSettings = {
        ...settings,
        dailyHour: importedSettings.dailyHour || settings.dailyHour,
        defaultAdvanceDays:
          importedSettings.defaultAdvanceDays ?? settings.defaultAdvanceDays,
      };
      setSettings(nextSettings);
      await saveSettingsToVault(nextSettings);
    }

    if (user && profileReady) {
      try {
        if (additions.length > 0) {
          await syncBirthdaysBatchToFirestore(user.uid, additions);
        }
        if (nextSettings) {
          await updateUserNotificationSettingsInFirestore(user.uid, nextSettings);
        }
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to import into cloud.');
      }
    }
  };

  const handleClearAllData = async () => {
    const prevBirthdayIds = birthdays.map((b) => b.id);
    const prevChatIds = chatMessages.map((m) => m.id);
    localStorage.setItem('broll_user_cleared_all', 'true');
    setBirthdays([]);
    setLogs([]);
    setChatMessages([]);
    setSettings(DEFAULT_NOTIFICATION_SETTINGS);
    await saveBirthdaysToVault([]);
    await saveLogsToVault([]);
    await saveChatMessagesToVault([]);
    await saveSettingsToVault(DEFAULT_NOTIFICATION_SETTINGS);

    if (user && profileReady) {
      try {
        await bulkDeleteBirthdaysInFirestore(user.uid, prevBirthdayIds);
        await clearChatMessagesInFirestore(user.uid, prevChatIds);
        await updateUserNotificationSettingsInFirestore(user.uid, DEFAULT_NOTIFICATION_SETTINGS);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to erase cloud records.');
      }
    }
  };

  const handleAppendChatMessages = async (newMessages: ChatMessageEntry[]) => {
    if (newMessages.length === 0) return;
    setChatMessages((prev) => {
      const next = [...prev, ...newMessages];
      void saveChatMessagesToVault(next);
      return next;
    });

    if (user && profileReady) {
      try {
        for (const msg of newMessages) {
          await saveChatMessageToFirestore(user.uid, msg);
        }
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to sync chat history.');
      }
    }
  };

  const handleClearChatMessages = async () => {
    const prevIds = chatMessages.map((m) => m.id);
    setChatMessages([]);
    await saveChatMessagesToVault([]);

    if (user && profileReady && prevIds.length > 0) {
      try {
        await clearChatMessagesInFirestore(user.uid, prevIds);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Unable to clear cloud chat.');
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50">
      {activeProfileEntry ? (
        <PersonProfilePage
          entry={activeProfileEntry}
          peopleList={computedBirthdays}
          workspaceToken={workspaceToken}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onSignIn={connectWorkspace}
          onAuthExpired={invalidateWorkspaceToken}
          onBack={closePersonPage}
          onSelectPerson={(entry) => openPersonPage(entry.id)}
          onEditCore={(entry) => handleOpenEditModal(entry)}
          onDeletePerson={handleDeleteBirthday}
          onToggleCelebrated={handleToggleCelebrated}
          onUpdateEntry={handleUpdateProfileFields}
        />
      ) : (
        <>
          {/* Full-Screen Workspace Shell */}
          <div className="flex-1 w-full bg-white dark:bg-neutral-950 flex">
        <SideRail
          activeView={activeView}
          onSelectView={setActiveView}
          onOpenAddModal={() => handleOpenAddModal()}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Bar inside Shell */}
          <header className="px-4 sm:px-8 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="md:hidden w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-neutral-950 dark:text-white shrink-0">
                <Leaf className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-lg sm:text-xl font-medium tracking-tight text-neutral-950 dark:text-white truncate">
                  {getGreeting()} — Broll
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {isCloudSynced
                    ? `Cloud-synced birthday agenda · Private to ${user?.displayName ?? user?.email ?? 'your account'}`
                    : 'Offline birthday agenda · Stored locally with zero tracking'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search birthdays..."
                  aria-label="Global birthday search"
                  className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveView('assistant')}
                title="Celebration Assistant"
                aria-label="Open Celebration Assistant"
                className={`w-9 h-9 rounded-lg border inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                  activeView === 'assistant'
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('reminders')}
                title="Local Notifications"
                aria-label="Open Local Notifications"
                className={`w-9 h-9 rounded-lg border inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                  activeView === 'reminders'
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <Bell className="w-4 h-4" />
              </button>

              {sheetsSync.configuredTarget?.parallelSyncEnabled && (
                <button
                  type="button"
                  onClick={() => setActiveView('sheets')}
                  title={`Google Sheets Parallel Sync: ${sheetsSync.configuredTarget.spreadsheetTitle}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">
                    {workspaceToken
                      ? sheetsSync.syncStatus === 'syncing'
                        ? 'Syncing...'
                        : 'Sheets Live'
                      : 'Sheets Paused'}
                  </span>
                </button>
              )}

              {authReady && (
                user ? (
                  <div className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? 'Account'}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-md object-cover grayscale"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-md bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center text-xs font-semibold">
                        {(user.displayName ?? user.email ?? 'U').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="hidden lg:inline text-xs font-medium text-neutral-800 dark:text-neutral-200 max-w-[110px] truncate">
                      {user.displayName?.split(' ')[0] ?? 'Synced'}
                    </span>
                    <Cloud className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                    <button
                      type="button"
                      onClick={signOut}
                      title="Sign out"
                      aria-label="Sign out"
                      className="p-1 rounded-md text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={signIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
                  >
                    <LogIn className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                    <span>Sign in</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Birthday
              </button>
            </div>
          </header>

          {/* Main Scrollable Viewport */}
          <main className="flex-1 p-4 sm:p-8 pb-20 md:pb-8 overflow-y-auto">
            {(authError || firestoreError) && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/10 flex items-start justify-between gap-3 text-xs text-rose-700 dark:text-rose-300"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{authError ?? firestoreError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (authError) clearAuthError();
                    if (firestoreError) setFirestoreError(null);
                  }}
                  aria-label="Dismiss error"
                  className="p-1 rounded hover:bg-rose-500/20 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isOnline && (
              <div
                role="status"
                className="mb-5 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-300"
              >
                <WifiOff className="w-4 h-4 text-neutral-950 dark:text-white shrink-0" />
                <span>
                  Offline Mode — All birthdays and reminders continue working locally on your device.
                </span>
              </div>
            )}

            {!isLoaded ? (
              <div
                className="space-y-5"
                aria-busy="true"
                aria-label="Loading local vault"
              >
                <div className="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                <div className="h-72 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
              </div>
            ) : (
              <>
                {activeView === 'calendar' && (
                  <CalendarWorkspace
                    birthdays={searchedBirthdays}
                    allBirthdays={computedBirthdays}
                    workspaceToken={workspaceToken}
                    onAuthExpired={invalidateWorkspaceToken}
                    onOpenProfile={(entry) => openPersonPage(entry.id)}
                    onEdit={handleOpenEditModal}
                    onToggleCelebrated={handleToggleCelebrated}
                    onAddForDate={(m, d) => handleOpenAddModal(m, d)}
                    onNavigateView={setActiveView}
                  />
                )}

                {activeView === 'upcoming' && (
                  <div className="space-y-6">
                    <SpotlightHero
                      birthdays={computedBirthdays}
                      vaultBytes={vaultBytes}
                      onToggleCelebrated={handleToggleCelebrated}
                      onOpenAddModal={() => handleOpenAddModal()}
                      onOpenProfile={(entry) => openPersonPage(entry.id)}
                    />
                    <UpcomingList
                      birthdays={filteredBirthdays}
                      totalSavedCount={birthdays.length}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      groupFilter={groupFilter}
                      onGroupFilterChange={setGroupFilter}
                      sortMode={sortMode}
                      onSortModeChange={setSortMode}
                      workspaceToken={workspaceToken}
                      onAuthExpired={invalidateWorkspaceToken}
                      onOpenProfile={(entry) => openPersonPage(entry.id)}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteBirthday}
                      onBulkDelete={handleBulkDeleteBirthdays}
                      onBulkReassignGroup={handleBulkReassignGroup}
                      onToggleCelebrated={handleToggleCelebrated}
                      onOpenAddModal={() => handleOpenAddModal()}
                    />
                    <StatisticsSection
                      birthdays={computedBirthdays}
                      isDarkMode={isDarkMode}
                      onSelectGroup={(group) => setGroupFilter(group)}
                    />
                  </div>
                )}

                {activeView === 'gallery' && (
                  <GallerySection
                    birthdays={computedBirthdays}
                    workspaceToken={workspaceToken}
                    onSignIn={connectWorkspace}
                    onAuthExpired={invalidateWorkspaceToken}
                    onOpenProfile={(entry) => openPersonPage(entry.id)}
                    onUpdateEntry={handleUpdateProfileFields}
                  />
                )}

                {activeView === 'statistics' && (
                  <div className="space-y-8">
                    <StatisticsSection
                      birthdays={computedBirthdays}
                      isDarkMode={isDarkMode}
                      onSelectGroup={(group) => {
                        setGroupFilter(group);
                        setActiveView('upcoming');
                      }}
                    />
                    <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
                      <h3 className="font-display text-lg font-medium text-neutral-950 dark:text-white mb-4">
                        Annual Overview
                      </h3>
                      <MonthCalendarGrid
                        birthdays={computedBirthdays}
                        onEdit={handleOpenEditModal}
                        onAddForMonth={(month) => handleOpenAddModal(month)}
                      />
                    </div>
                  </div>
                )}

                {activeView === 'assistant' && (
                  <ChatbotPanel
                    birthdays={computedBirthdays}
                    messages={chatMessages}
                    onAppendMessages={handleAppendChatMessages}
                    onClearMessages={handleClearChatMessages}
                  />
                )}

                {activeView === 'sheets' && (
                  <GoogleSheetsPanel
                    birthdays={birthdays}
                    onImportBirthdays={handleImportBirthdays}
                    onReplaceBirthdays={handleApplySheetEntries}
                    configuredTarget={sheetsSync.configuredTarget}
                    onUpdateConfiguredTarget={sheetsSync.updateConfiguredTarget}
                    incompleteRows={sheetsSync.incompleteRows}
                    onUpdateIncompleteRows={sheetsSync.updateIncompleteRows}
                    syncStatus={sheetsSync.syncStatus}
                    syncError={sheetsSync.syncError}
                    onEnableParallelSync={sheetsSync.enableParallelSync}
                    onPauseParallelSync={sheetsSync.pauseParallelSync}
                    onSyncNow={sheetsSync.syncNow}
                    onRecordSnapshot={sheetsSync.recordSnapshot}
                  />
                )}

                {activeView === 'reminders' && (
                  <RemindersPanel
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    birthdays={computedBirthdays}
                    logs={logs}
                    onAppendLog={handleAppendLog}
                    onClearLogs={handleClearLogs}
                  />
                )}

                {activeView === 'vault' && (
                  <PrivacyVaultPanel
                    birthdays={birthdays}
                    settings={settings}
                    logs={logs}
                    vaultBytes={vaultBytes}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                    onImportBirthdays={handleImportBirthdays}
                    onClearAllData={handleClearAllData}
                    userEmail={user?.email}
                    userName={user?.displayName}
                    isCloudSynced={isCloudSynced}
                    onSignIn={signIn}
                    onSignOut={signOut}
                    onOpenGoogleSheets={() => setActiveView('sheets')}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

          <MobileBottomNav activeView={activeView} onSelectView={setActiveView} />
        </>
      )}

      <BirthdayFormModal
        isOpen={isModalOpen}
        editingEntry={editingEntry}
        initialMonth={modalInitialMonth}
        initialDay={modalInitialDay}
        defaultAdvanceDays={settings.defaultAdvanceDays}
        workspaceToken={workspaceToken}
        onAuthExpired={invalidateWorkspaceToken}
        onOpenProfile={(entry) => openPersonPage(entry.id)}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveBirthday}
      />
    </div>
  );
}
