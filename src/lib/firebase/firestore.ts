import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { StoredProject } from '@/features/projects/types';
import { sanitizeForFirestore, restoreFromFirestore } from './firestoreSanitize';

const PROJECTS_COLLECTION = 'projects';
const SHARED_COLLECTION = 'sharedProjects';

function userProjectsCollection(uid: string) {
  return collection(db, 'users', uid, PROJECTS_COLLECTION);
}

function userProjectDoc(uid: string, projectId: string) {
  return doc(db, 'users', uid, PROJECTS_COLLECTION, projectId);
}

function sharedProjectDoc(token: string) {
  return doc(db, SHARED_COLLECTION, token);
}

export class FirestoreProjectStorage {
  static async saveProject(uid: string, project: StoredProject): Promise<void> {
    const docRef = userProjectDoc(uid, project.metadata.id);
    const safe = sanitizeForFirestore({ ...project, _syncedAt: serverTimestamp() });
    await setDoc(docRef, safe);
  }

  static async getProject(uid: string, projectId: string): Promise<StoredProject | null> {
    const snap = await getDoc(userProjectDoc(uid, projectId));
    if (!snap.exists()) return null;
    const data = snap.data();
    delete data._syncedAt;
    return restoreFromFirestore(data) as StoredProject;
  }

  static async getAllProjects(uid: string): Promise<StoredProject[]> {
    const q = query(userProjectsCollection(uid), orderBy('_syncedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      delete data._syncedAt;
      return restoreFromFirestore(data) as StoredProject;
    });
  }

  static async deleteProject(uid: string, projectId: string): Promise<void> {
    await deleteDoc(userProjectDoc(uid, projectId));
  }

  static async saveAllProjects(uid: string, projects: StoredProject[]): Promise<void> {
    const writes = projects.map((p) => {
      const docRef = userProjectDoc(uid, p.metadata.id);
      const safe = sanitizeForFirestore({ ...p, _syncedAt: serverTimestamp() });
      return setDoc(docRef, safe);
    });
    await Promise.all(writes);
  }

  // ── Sharing ──

  /** Generate a unique share token for a project */
  private static generateShareToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /** Create a share link: stores project data in sharedProjects collection */
  static async createShareLink(uid: string, project: StoredProject): Promise<string> {
    const token = this.generateShareToken();
    const docRef = sharedProjectDoc(token);
    const safe = sanitizeForFirestore({
      ...project,
      _sharedBy: uid,
      _sharedAt: serverTimestamp(),
    });
    await setDoc(docRef, safe);
    return token;
  }

  /** Read a shared project by token (no auth required) */
  static async getSharedProject(token: string): Promise<StoredProject | null> {
    const snap = await getDoc(sharedProjectDoc(token));
    if (!snap.exists()) return null;
    const data = snap.data();
    delete data._sharedBy;
    delete data._sharedAt;
    return restoreFromFirestore(data) as StoredProject;
  }

  /** Revoke a share link */
  static async revokeShareLink(token: string): Promise<void> {
    await deleteDoc(sharedProjectDoc(token));
  }
}
