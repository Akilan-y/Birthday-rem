import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  auth,
  clearCachedAccessToken,
  getCachedAccessToken,
  signInWithGoogle,
  signOutUser,
} from '../firebase';
import {ensureUserProfile} from '../utils/firestoreVault';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  authError: string | null;
  workspaceToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  invalidateWorkspaceToken: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(() =>
    getCachedAccessToken()
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        clearCachedAccessToken();
        setWorkspaceToken(null);
        setProfileReady(false);
        return;
      }

      try {
        await ensureUserProfile(nextUser);
        setProfileReady(true);
        setAuthError(null);
      } catch (err) {
        setProfileReady(false);
        setAuthError(
          err instanceof Error ? err.message : 'Unable to verify cloud profile.'
        );
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      const token = await signInWithGoogle();
      setWorkspaceToken(token);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.'
      );
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    setProfileReady(false);
    clearCachedAccessToken();
    setWorkspaceToken(null);
    await signOutUser();
  }, []);

  const invalidateWorkspaceToken = useCallback(() => {
    clearCachedAccessToken();
    setWorkspaceToken(null);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        authError,
        workspaceToken,
        signIn: handleSignIn,
        signOut: handleSignOut,
        invalidateWorkspaceToken,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
