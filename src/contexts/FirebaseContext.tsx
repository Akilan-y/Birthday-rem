import React, {createContext, useContext, useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {auth, signInWithGoogle, signOutUser} from '../firebase';
import {ensureUserProfile} from '../utils/firestoreVault';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
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

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.'
      );
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    setProfileReady(false);
    await signOutUser();
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        authError,
        signIn: handleSignIn,
        signOut: handleSignOut,
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
