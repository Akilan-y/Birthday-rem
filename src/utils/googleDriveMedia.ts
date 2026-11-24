import type {PersonPhotoItem} from '../types/birthday';
import {WorkspaceAuthError} from './googleSheets';

const BROLL_PHOTOS_FOLDER_NAME = 'Broll Photos';

let cachedFolderId: string | null = null;
const driveObjectUrlCache = new Map<string, string>();
const inFlightUrlFetches = new Map<string, Promise<string>>();

export function clearDriveMediaCache(): void {
  cachedFolderId = null;
  for (const url of driveObjectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  driveObjectUrlCache.clear();
  inFlightUrlFetches.clear();
}

export function getCachedDriveImageUrl(fileId: string): string | null {
  return driveObjectUrlCache.get(fileId) ?? null;
}

async function parseDriveError(res: Response): Promise<string> {
  if (res.status === 401) {
    throw new WorkspaceAuthError('Google Drive session expired. Please sign in again.');
  }
  try {
    const body = (await res.json()) as {error?: {message?: string}};
    if (body?.error?.message) return body.error.message;
  } catch {
    // ignore JSON parse failure
  }
  return `Google Drive request failed (${res.status})`;
}

export async function ensureBrollPhotosFolder(accessToken: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${BROLL_PHOTOS_FOLDER_NAME}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    }
  );

  if (!searchRes.ok) {
    throw new Error(await parseDriveError(searchRes));
  }

  const searchData = (await searchRes.json()) as {files?: Array<{id: string; name: string}>};
  const existing = searchData.files?.[0];
  if (existing?.id) {
    cachedFolderId = existing.id;
    return existing.id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BROLL_PHOTOS_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {brollMediaRoot: 'true'},
    }),
  });

  if (!createRes.ok) {
    throw new Error(await parseDriveError(createRes));
  }

  const created = (await createRes.json()) as {id: string};
  cachedFolderId = created.id;
  return created.id;
}

export async function createAvatarThumbnailDataUrl(
  file: Blob,
  maxSize = 160
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });

    const side = Math.min(img.naturalWidth || maxSize, img.naturalHeight || maxSize);
    const sx = Math.max(0, ((img.naturalWidth || side) - side) / 2);
    const sy = Math.max(0, ((img.naturalHeight || side) - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createCompactLocalPreviewUrl(
  file: Blob,
  maxDimension = 640
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });

    const w = img.naturalWidth || maxDimension;
    const h = img.naturalHeight || maxDimension;
    const scale = Math.min(1, maxDimension / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadPersonPhotoToDrive(
  accessToken: string,
  options: {
    personId: string;
    personName: string;
    kind: 'avatar' | 'gallery';
    file: File;
    caption?: string;
  }
): Promise<PersonPhotoItem> {
  const folderId = await ensureBrollPhotosFolder(accessToken);
  const safePerson = options.personName.trim().replace(/[^\w\s-]/g, '').slice(0, 40) || 'Person';
  const ext = options.file.name.includes('.')
    ? options.file.name.slice(options.file.name.lastIndexOf('.'))
    : '.jpg';
  const baseName = `${safePerson} - ${options.kind === 'avatar' ? 'Profile' : 'Memory'} - ${new Date()
    .toISOString()
    .slice(0, 10)}${ext}`;

  const metadata = {
    name: baseName.slice(0, 160),
    parents: [folderId],
    description: options.caption?.trim().slice(0, 200) || undefined,
    appProperties: {
      brollPersonId: options.personId.slice(0, 100),
      brollKind: options.kind,
    },
  };

  const boundary = `broll_${crypto.randomUUID().replace(/-/g, '')}`;
  const mimeType = options.file.type || 'image/jpeg';
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const endBoundary = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metaPart, mediaHeader, options.file, endBoundary], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: bodyBlob,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(await parseDriveError(uploadRes));
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name?: string;
    mimeType?: string;
    createdTime?: string;
  };

  // Warm the in-memory image cache with the exact local file immediately
  const instantUrl = URL.createObjectURL(options.file);
  driveObjectUrlCache.set(uploaded.id, instantUrl);

  return {
    id: uploaded.id,
    driveFileId: uploaded.id,
    name: (uploaded.name ?? options.file.name).slice(0, 160),
    mimeType: (uploaded.mimeType ?? mimeType).slice(0, 80),
    caption: options.caption?.trim().slice(0, 200) || undefined,
    createdAt: uploaded.createdTime ?? new Date().toISOString(),
  };
}

export async function fetchDriveImageObjectUrl(
  accessToken: string,
  fileId: string
): Promise<string> {
  const cached = driveObjectUrlCache.get(fileId);
  if (cached) return cached;

  const pending = inFlightUrlFetches.get(fileId);
  if (pending) return pending;

  const task = (async () => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(await parseDriveError(res));
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    driveObjectUrlCache.set(fileId, objectUrl);
    return objectUrl;
  })();

  inFlightUrlFetches.set(fileId, task);
  try {
    return await task;
  } finally {
    inFlightUrlFetches.delete(fileId);
  }
}

export async function deleteDrivePhoto(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // Treat 404 as already removed from Drive so local/Firestore cleanup succeeds
  if (!res.ok && res.status !== 404) {
    throw new Error(await parseDriveError(res));
  }

  const cached = driveObjectUrlCache.get(fileId);
  if (cached) {
    URL.revokeObjectURL(cached);
    driveObjectUrlCache.delete(fileId);
  }
}
