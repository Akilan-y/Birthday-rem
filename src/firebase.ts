import {initializeApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {clearDriveMediaCache} from './utils/googleDriveMedia';

const app = initializeApp(firebaseConfig);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
] as const;

const databaseId =
  (firebaseConfig as {firestoreDatabaseId?: string}).firestoreDatabaseId ||
  'ai-studio-brollofflinebirt-ec36f2bc-ca89-4400-8a45-253876c44181';

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const basicGoogleProvider = new GoogleAuthProvider();
basicGoogleProvider.setCustomParameters({prompt: 'select_account'});

export const googleProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({prompt: 'select_account'});

// In-memory only: never persist OAuth access tokens to localStorage or sessionStorage.
let cachedAccessToken: string | null = null;

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
  clearDriveMediaCache();
}

export function formatGoogleAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  if (lower.includes('policy_enforced') || lower.includes('advanced protection')) {
    return 'Google blocked access because this account has Advanced Protection enabled (Error 400: policy_enforced). Use a Google account without Advanced Protection for Drive/Sheets sync, or continue using local vault storage for profiles and gallery photos.';
  }
  if (lower.includes('popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing.';
  }
  if (lower.includes('popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  return raw || 'Google sign-in was cancelled or failed.';
}

export async function signInBasicWithGoogle(): Promise<void> {
  await signInWithPopup(auth, basicGoogleProvider);
}

export async function signInWithGoogle(): Promise<string | null> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken ?? null;
  return cachedAccessToken;
}

export async function signOutUser(): Promise<void> {
  cachedAccessToken = null;
  clearDriveMediaCache();
  await signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();
