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

/**
 * Recursively sanitize data for Firestore: nested arrays are not supported.
 * - Array of Arrays → convert outer array to object with numeric-string keys
 * - Flat arrays of primitives are kept
 * - Objects are recursively sanitized
 */
function sanitizeForFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    if (value.length > 0 && Array.isArray(value[0])) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < value.length; i++) {
        obj[String(i)] = sanitizeForFirestore(value[i]);
      }
      return obj;
    }
    return value.map(sanitizeForFirestore).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue; // Firestore rejects undefined field values
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  return value;
}

/**
 * Reverse the sanitization: convert object-with-numeric-keys back to arrays.
 */
function restoreFromFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(restoreFromFirestore);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      const arr: unknown[] = new Array(maxIdx + 1);
      for (const k of keys) {
        arr[Number(k)] = restoreFromFirestore(obj[k]);
      }
      return arr;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = restoreFromFirestore(v);
    }
    return out;
  }
  return value;
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
