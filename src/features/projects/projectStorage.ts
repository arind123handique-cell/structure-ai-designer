import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StoredProject, SerializedStructuralModel } from './types';
import { NormalizedStructuralModel } from '@/features/model/types';
import { FirestoreProjectStorage } from '@/lib/firebase/firestore';

interface StructureAIDB extends DBSchema {
  projects: {
    key: string;
    value: StoredProject;
  };
}

const DB_NAME = 'StructureAIDesignerDB';
const DB_VERSION = 1;

/**
 * Recursively sanitize data for Firestore: nested arrays are not supported.
 * - Array of Arrays → convert outer array to object with numeric-string keys
 * - Flat arrays of primitives are kept (Firestore supports them)
 * - Objects are recursively sanitized
 */
function sanitizeForFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const hasNested = value.some((el) => Array.isArray(el));
    if (hasNested) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < value.length; i++) {
        obj[String(i)] = sanitizeForFirestore(value[i]);
      }
      return obj;
    }
    return value.map(sanitizeForFirestore);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  return value;
}

/**
 * Reverse the sanitization: convert object-with-numeric-keys back to arrays.
 * Only targets objects whose keys are all numeric strings (our serialized Map entries).
 */
function restoreFromFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(restoreFromFirestore);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    // If all keys are numeric strings, convert back to array
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      const arr: unknown[] = new Array(maxIdx + 1);
      for (const k of keys) {
        arr[Number(k)] = restoreFromFirestore(obj[k]);
      }
      return arr;
    }
    // Otherwise recurse
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = restoreFromFirestore(v);
    }
    return out;
  }
  return value;
}

export class ProjectStorage {
  private static dbPromise: Promise<IDBPDatabase<StructureAIDB>> | null = null;

  private static getDB(): Promise<IDBPDatabase<StructureAIDB>> {
    if (!this.dbPromise) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('indexedDB is not defined in this environment'));
      }
      this.dbPromise = openDB<StructureAIDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('projects')) {
            db.createObjectStore('projects', { keyPath: 'metadata.id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  private static currentUid: string | null = null;

  public static setCloudUser(uid: string | null) {
    ProjectStorage.currentUid = uid;
  }

  public static serializeModel(model: NormalizedStructuralModel): SerializedStructuralModel {
    return {
      nodes: Array.from(model.nodes.entries()),
      members: Array.from(model.members.entries()),
      plates: Array.from(model.plates.entries()),
      supports: Array.from(model.supports.entries()),
      loadCases: Array.from(model.loadCases.entries()),
      loadCombinations: Array.from(model.loadCombinations.entries()),
      memberLoads: model.memberLoads ? Array.from(model.memberLoads.entries()) : undefined,
      shellLoads: model.shellLoads,
      extLoads: model.extLoads,
      memberModifiers: model.memberModifiers ? Array.from(model.memberModifiers.entries()) : undefined,
      reactions: model.reactions,
      memberForces: model.memberForces,
      nodeDisplacements: model.nodeDisplacements ? Array.from(model.nodeDisplacements.entries()) : undefined,
      designSummaries: model.designSummaries ? Array.from(model.designSummaries.entries()) : undefined,
      storyDrifts: model.storyDrifts,
      boundingBox: model.boundingBox,
      statistics: model.statistics,
    };
  }

  public static deserializeModel(serialized: SerializedStructuralModel): NormalizedStructuralModel {
    return {
      nodes: new Map(serialized.nodes),
      members: new Map(serialized.members),
      plates: new Map(serialized.plates),
      supports: new Map(serialized.supports),
      loadCases: new Map(serialized.loadCases),
      loadCombinations: new Map(serialized.loadCombinations),
      memberLoads: serialized.memberLoads ? new Map(serialized.memberLoads) : new Map(),
      shellLoads: serialized.shellLoads || [],
      extLoads: serialized.extLoads,
      memberModifiers: serialized.memberModifiers ? new Map(serialized.memberModifiers) : new Map(),
      reactions: serialized.reactions,
      memberForces: serialized.memberForces,
      nodeDisplacements: serialized.nodeDisplacements ? new Map(serialized.nodeDisplacements) : undefined,
      designSummaries: serialized.designSummaries ? new Map(serialized.designSummaries) : new Map(),
      storyDrifts: serialized.storyDrifts,
      boundingBox: serialized.boundingBox,
      statistics: serialized.statistics,
    };
  }

  public static async saveProject(project: StoredProject): Promise<void> {
    const db = await this.getDB();
    await db.put('projects', project);
    // Sync to cloud in background (fire-and-forget)
    if (this.currentUid) {
      FirestoreProjectStorage.saveProject(this.currentUid, project).catch((e) =>
        console.warn('Cloud sync failed (saved locally):', e)
      );
    }
  }

  public static async getProject(id: string): Promise<StoredProject | undefined> {
    const db = await this.getDB();
    return await db.get('projects', id);
  }

  public static async getAllProjects(): Promise<StoredProject[]> {
    const db = await this.getDB();
    return await db.getAll('projects');
  }

  public static async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('projects', id);
    if (this.currentUid) {
      FirestoreProjectStorage.deleteProject(this.currentUid, id).catch((e) =>
        console.warn('Cloud delete failed:', e)
      );
    }
  }

  /** Pull all projects from Firestore and merge into IndexedDB (cloud → local) */
  public static async syncFromCloud(): Promise<number> {
    if (!this.currentUid) return 0;
    try {
      const cloudProjects = await FirestoreProjectStorage.getAllProjects(this.currentUid);
      const db = await this.getDB();
      let merged = 0;
      for (const cp of cloudProjects) {
        const local = await db.get('projects', cp.metadata.id);
        const localTime = local?.metadata.updatedAt ? new Date(local.metadata.updatedAt).getTime() : 0;
        const cloudTime = cp.metadata.updatedAt ? new Date(cp.metadata.updatedAt).getTime() : 0;
        // Cloud wins if newer or if no local exists
        if (!local || cloudTime > localTime) {
          await db.put('projects', cp);
          merged++;
        }
      }
      return merged;
    } catch (e) {
      console.warn('Cloud sync failed:', e);
      return 0;
    }
  }

  /** Push all local projects to Firestore (local → cloud) */
  public static async syncToCloud(): Promise<number> {
    if (!this.currentUid) return 0;
    try {
      const localProjects = await this.getAllProjects();
      await FirestoreProjectStorage.saveAllProjects(this.currentUid, localProjects);
      return localProjects.length;
    } catch (e) {
      console.warn('Cloud push failed:', e);
      return 0;
    }
  }
}
