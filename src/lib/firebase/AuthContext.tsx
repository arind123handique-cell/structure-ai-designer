import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './config';

// Local-only (offline) session marker.
const LOCAL_MODE_UID = 'local-mode-user';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  authUnreachable: boolean;
  isLocalMode: boolean;
  signInLocalMode: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  sendResetPasswordEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** Fabricate a minimal User-like session for offline/local-only use. */
function createLocalUser(): User {
  const base = {
    uid: LOCAL_MODE_UID,
    email: 'local@structureai.local',
    emailVerified: false,
    displayName: 'Local Engineer',
    isAnonymous: false,
    photoURL: null,
    phoneNumber: null,
    providerId: 'local',
    metadata: { creationTime: null, lastSignInTime: null },
    providerData: [],
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
  };
  return base as unknown as User;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUnreachable, setAuthUnreachable] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(() => {
    try {
      return localStorage.getItem('structureai:localMode') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // If a previous session chose Local Mode, restore it instantly — the app
    // must never hang on the Firebase network when offline.
    if (isLocalMode) {
      setUser(createLocalUser());
      setLoading(false);
      return;
    }

    let settled = false;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      settled = true;
      setUser(u);
      setLoading(false);
    });

    // Watchdog: if Firebase Auth cannot be reached (offline / network blocked),
    // do NOT hang forever on the loading screen. Surface an offline fallback.
    const watchdog = setTimeout(() => {
      if (!settled) {
        setAuthUnreachable(true);
        setLoading(false);
      }
    }, 8000);

    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [isLocalMode]);

  const signInLocalMode = () => {
    try {
      localStorage.setItem('structureai:localMode', '1');
    } catch {}
    setIsLocalMode(true);
    setAuthUnreachable(false);
    setUser(createLocalUser());
    setLoading(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error('No user is currently signed in.');
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  };

  const updateUserProfile = async (displayName: string) => {
    if (!auth.currentUser) throw new Error('No user is currently signed in.');
    await firebaseUpdateProfile(auth.currentUser, { displayName });
    setUser({ ...auth.currentUser });
  };

  const sendResetPasswordEmail = async (email: string) => {
    await firebaseSendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('structureai:localMode');
    } catch {}
    setIsLocalMode(false);
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authUnreachable,
        isLocalMode,
        signInLocalMode,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        changePassword,
        updateUserProfile,
        sendResetPasswordEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
