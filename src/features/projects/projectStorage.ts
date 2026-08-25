import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StoredProject, SerializedStructuralModel } from './types';
import { NormalizedStructuralModel } from '@/features/model/types';

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
  }
}
