import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDUD9M74Mg87j7JvVFSdTl0jao9EGSil_4',
  authDomain: 'structureai-7805e.firebaseapp.com',
  projectId: 'structureai-7805e',
  storageBucket: 'structureai-7805e.firebasestorage.app',
  messagingSenderId: '1081811852933',
  appId: '1:1081811852933:web:bb7cd915ba5380c5e593ec',
  measurementId: 'G-J2HLCPTP4E',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with modern persistent multi-tab cache (replaces deprecated enableMultiTabIndexedDbPersistence)
export const db =
  typeof indexedDB !== 'undefined'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : initializeFirestore(app, {});

