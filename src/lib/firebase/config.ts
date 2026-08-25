import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

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
export const db = getFirestore(app);

// Enable offline persistence (IndexedDB-backed)
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore offline persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore offline persistence not supported by this browser');
  }
});
