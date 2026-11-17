import type {User} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {db, handleFirestoreError, OperationType} from '../firebase';
import type {
  AdvanceNoticeDays,
  AssistantPersona,
  BirthdayEntry,
  ChatMessageEntry,
  NotificationSettings,
  RelationshipGroup,
} from '../types/birthday';

const VALID_GROUPS = new Set<RelationshipGroup>([
  'Family',
  'Friends',
  'Colleagues',
  'Community',
]);
const VALID_ADVANCE = new Set<AdvanceNoticeDays>([0, 1, 3, 7]);
const VALID_PERSONAS = new Set<AssistantPersona>([
  'eco-gifting',
  'milestone-planner',
  'quick-wishes',
]);

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || crypto.randomUUID();
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function sanitizeBirthdayPayload(uid: string, entry: BirthdayEntry) {
  const id = sanitizeId(entry.id);
  const safeName = entry.name.trim().slice(0, 80) || 'Birthday';
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(entry.month)));
  const safeDay = Math.min(31, Math.max(1, Math.trunc(entry.day)));
  const safeBirthYear =
    typeof entry.birthYear === 'number' &&
    entry.birthYear >= 1900 &&
    entry.birthYear <= 2100
      ? Math.trunc(entry.birthYear)
      : null;
  const safeGroup: RelationshipGroup = VALID_GROUPS.has(entry.group)
    ? entry.group
    : 'Friends';
  const safeNote = (entry.note ?? '').trim().slice(0, 280);
  const safeAdvance: AdvanceNoticeDays = VALID_ADVANCE.has(entry.advanceDays)
    ? entry.advanceDays
    : 1;
  const safeYears = Array.isArray(entry.celebratedYears)
    ? entry.celebratedYears
        .filter((y): y is number => typeof y === 'number' && Number.isInteger(y))
        .slice(0, 100)
    : [];

  return {
    id,
    ownerId: uid,
    name: safeName,
    month: safeMonth,
    day: safeDay,
    birthYear: safeBirthYear,
    group: safeGroup,
    note: safeNote,
    advanceDays: safeAdvance,
    celebratedYears: safeYears,
  };
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName ?? 'User').trim().slice(0, 120) || 'User';
    const email = (user.email ?? '').trim().slice(0, 200);
    const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : null;

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        dailyHour: '09:00',
        defaultAdvanceDays: 1,
        notificationsEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserProfile(
  uid: string,
  onSettings: (settings: Partial<NotificationSettings>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onSettings({
        dailyHour: typeof data.dailyHour === 'string' ? data.dailyHour : '09:00',
        defaultAdvanceDays: VALID_ADVANCE.has(data.defaultAdvanceDays)
          ? data.defaultAdvanceDays
          : 1,
        enabled:
          typeof data.notificationsEnabled === 'boolean'
            ? data.notificationsEnabled
            : false,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export async function updateUserNotificationSettingsInFirestore(
  uid: string,
  settings: NotificationSettings
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const dailyHour = /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(settings.dailyHour)
    ? settings.dailyHour
    : '09:00';
  const defaultAdvanceDays = VALID_ADVANCE.has(settings.defaultAdvanceDays)
    ? settings.defaultAdvanceDays
    : 1;

  try {
    await updateDoc(ref, {
      dailyHour,
      defaultAdvanceDays,
      notificationsEnabled: Boolean(settings.enabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToBirthdaysInFirestore(
  uid: string,
  onBirthdays: (entries: BirthdayEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/birthdays`;
  const q = query(collection(db, 'users', uid, 'birthdays'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: BirthdayEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: typeof d.id === 'string' ? d.id : docSnap.id,
          name: typeof d.name === 'string' ? d.name : 'Unnamed',
          month: typeof d.month === 'number' ? d.month : 1,
          day: typeof d.day === 'number' ? d.day : 1,
          birthYear: typeof d.birthYear === 'number' ? d.birthYear : null,
          group: VALID_GROUPS.has(d.group) ? d.group : 'Friends',
          note: typeof d.note === 'string' ? d.note : '',
          advanceDays: VALID_ADVANCE.has(d.advanceDays) ? d.advanceDays : 1,
          celebratedYears: Array.isArray(d.celebratedYears)
            ? d.celebratedYears.filter((y): y is number => typeof y === 'number')
            : [],
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onBirthdays(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export async function createBirthdayInFirestore(
  uid: string,
  entry: BirthdayEntry
): Promise<void> {
  const payload = sanitizeBirthdayPayload(uid, entry);
  const path = `users/${uid}/birthdays/${payload.id}`;
  const ref = doc(db, 'users', uid, 'birthdays', payload.id);

  try {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBirthdayInFirestore(
  uid: string,
  entry: BirthdayEntry
): Promise<void> {
  const payload = sanitizeBirthdayPayload(uid, entry);
  const path = `users/${uid}/birthdays/${payload.id}`;
  const ref = doc(db, 'users', uid, 'birthdays', payload.id);

  try {
    await updateDoc(ref, {
      name: payload.name,
      month: payload.month,
      day: payload.day,
      birthYear: payload.birthYear,
      group: payload.group,
      note: payload.note,
      advanceDays: payload.advanceDays,
      celebratedYears: payload.celebratedYears,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBirthdayInFirestore(
  uid: string,
  birthdayId: string
): Promise<void> {
  const id = sanitizeId(birthdayId);
  const path = `users/${uid}/birthdays/${id}`;
  const ref = doc(db, 'users', uid, 'birthdays', id);

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function bulkDeleteBirthdaysInFirestore(
  uid: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const path = `users/${uid}/birthdays`;
  try {
    const batch = writeBatch(db);
    for (const rawId of ids) {
      const id = sanitizeId(rawId);
      batch.delete(doc(db, 'users', uid, 'birthdays', id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function bulkReassignBirthdaysInFirestore(
  uid: string,
  ids: string[],
  group: RelationshipGroup
): Promise<void> {
  if (ids.length === 0) return;
  const safeGroup: RelationshipGroup = VALID_GROUPS.has(group) ? group : 'Friends';
  const path = `users/${uid}/birthdays`;
  try {
    const batch = writeBatch(db);
    for (const rawId of ids) {
      const id = sanitizeId(rawId);
      batch.update(doc(db, 'users', uid, 'birthdays', id), {
        group: safeGroup,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncBirthdaysBatchToFirestore(
  uid: string,
  entries: BirthdayEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  const path = `users/${uid}/birthdays`;
  try {
    const batch = writeBatch(db);
    for (const entry of entries) {
      const payload = sanitizeBirthdayPayload(uid, entry);
      const ref = doc(db, 'users', uid, 'birthdays', payload.id);
      batch.set(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToChatMessagesInFirestore(
  uid: string,
  onMessages: (messages: ChatMessageEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/chatMessages`;
  const q = query(
    collection(db, 'users', uid, 'chatMessages'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessageEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: typeof d.id === 'string' ? d.id : docSnap.id,
          role: d.role === 'model' ? 'model' : 'user',
          text: typeof d.text === 'string' ? d.text : '',
          persona: VALID_PERSONAS.has(d.persona) ? d.persona : 'eco-gifting',
          model: typeof d.model === 'string' ? d.model : 'gemini-4-hydrogen',
          createdAt: toIsoString(d.createdAt),
        };
      });
      onMessages(messages);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export async function saveChatMessageToFirestore(
  uid: string,
  msg: ChatMessageEntry
): Promise<void> {
  const id = sanitizeId(msg.id);
  const path = `users/${uid}/chatMessages/${id}`;
  const ref = doc(db, 'users', uid, 'chatMessages', id);

  try {
    await setDoc(ref, {
      id,
      ownerId: uid,
      role: msg.role === 'model' ? 'model' : 'user',
      text: msg.text.trim().slice(0, 8000) || ' ',
      persona: VALID_PERSONAS.has(msg.persona) ? msg.persona : 'eco-gifting',
      model: msg.model.slice(0, 64) || 'gemini-4-hydrogen',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function clearChatMessagesInFirestore(
  uid: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  const path = `users/${uid}/chatMessages`;
  try {
    const batch = writeBatch(db);
    for (const rawId of messageIds) {
      batch.delete(doc(db, 'users', uid, 'chatMessages', sanitizeId(rawId)));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
