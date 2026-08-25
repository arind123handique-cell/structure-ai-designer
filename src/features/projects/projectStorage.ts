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

export class ProjectStorage {
  private static dbPromise: Promise<IDBPDatabase<StructureAIDB>> = openDB<StructureAIDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'metadata.id' });
      }
    },
  });

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
      reactions: model.reactions,
      memberForces: model.memberForces,
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
      reactions: serialized.reactions,
      memberForces: serialized.memberForces,
      designSummaries: serialized.designSummaries ? new Map(serialized.designSummaries) : new Map(),
      storyDrifts: serialized.storyDrifts,
      boundingBox: serialized.boundingBox,
      statistics: serialized.statistics,
    };
  }

  public static async saveProject(project: StoredProject): Promise<void> {
    const db = await this.dbPromise;
    await db.put('projects', project);
    // Sync to cloud in background (fire-and-forget)
    if (this.currentUid) {
      FirestoreProjectStorage.saveProject(this.currentUid, project).catch((e) =>
        console.warn('Cloud sync failed (saved locally):', e)
      );
    }
  }

  public static async getProject(id: string): Promise<StoredProject | undefined> {
    const db = await this.dbPromise;
    return await db.get('projects', id);
  }

  public static async getAllProjects(): Promise<StoredProject[]> {
    const db = await this.dbPromise;
    return await db.getAll('projects');
  }

  public static async deleteProject(id: string): Promise<void> {
    const db = await this.dbPromise;
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
      const db = await this.dbPromise;
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
