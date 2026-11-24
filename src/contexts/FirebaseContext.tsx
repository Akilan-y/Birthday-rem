import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  auth,
  clearCachedAccessToken,
  formatGoogleAuthError,
  getCachedAccessToken,
  signInBasicWithGoogle,
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
  connectWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
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
        setAuthError(formatGoogleAuthError(err));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInBasicWithGoogle();
    } catch (err) {
      setAuthError(formatGoogleAuthError(err));
    }
  }, []);

  const handleConnectWorkspace = useCallback(async () => {
    setAuthError(null);
    try {
      const token = await signInWithGoogle();
      setWorkspaceToken(token);
    } catch (err) {
      setAuthError(formatGoogleAuthError(err));
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    setProfileReady(false);
    clearCachedAccessToken();
    setWorkspaceToken(null);
    await signOutUser();
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
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
        connectWorkspace: handleConnectWorkspace,
        signOut: handleSignOut,
        clearAuthError,
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
