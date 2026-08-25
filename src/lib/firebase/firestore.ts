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

function userProjectsCollection(uid: string) {
  return collection(db, 'users', uid, PROJECTS_COLLECTION);
}

function userProjectDoc(uid: string, projectId: string) {
  return doc(db, 'users', uid, PROJECTS_COLLECTION, projectId);
}

export class FirestoreProjectStorage {
  static async saveProject(uid: string, project: StoredProject): Promise<void> {
    const docRef = userProjectDoc(uid, project.metadata.id);
    await setDoc(docRef, {
      ...project,
      _syncedAt: serverTimestamp(),
    });
  }

  static async getProject(uid: string, projectId: string): Promise<StoredProject | null> {
    const snap = await getDoc(userProjectDoc(uid, projectId));
    if (!snap.exists()) return null;
    const data = snap.data();
    delete data._syncedAt;
    return data as StoredProject;
  }

  static async getAllProjects(uid: string): Promise<StoredProject[]> {
    const q = query(userProjectsCollection(uid), orderBy('_syncedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      delete data._syncedAt;
      return data as StoredProject;
    });
  }

  static async deleteProject(uid: string, projectId: string): Promise<void> {
    await deleteDoc(userProjectDoc(uid, projectId));
  }

  static async saveAllProjects(uid: string, projects: StoredProject[]): Promise<void> {
    const writes = projects.map((p) => {
      const docRef = userProjectDoc(uid, p.metadata.id);
      return setDoc(docRef, { ...p, _syncedAt: serverTimestamp() });
    });
    await Promise.all(writes);
  }
}
