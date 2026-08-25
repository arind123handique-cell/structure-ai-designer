import {
  Node3D,
  Member3D,
  Plate3D,
  Support3D,
  LoadCase,
  LoadCombination,
  JointReaction,
  MemberForceRecord,
  MemberDesignSummary,
  StoryDriftRecord,
  NormalizedStructuralModel,
} from './types';
import { StructuralClassification } from '@/types';

export class ModelNormalizer {
  public static normalize(
    nodes: Map<number, Node3D>,
    rawMembers: Map<number, Partial<Member3D>>,
    plates: Map<number, Plate3D>,
    supports: Map<number, Support3D>,
    loadCases: Map<number, LoadCase>,
    loadCombinations: Map<number, LoadCombination>,
    reactions: JointReaction[],
    memberForces: MemberForceRecord[],
    storyDrifts: StoryDriftRecord[],
    designSummaries?: Map<number, MemberDesignSummary>
  ): NormalizedStructuralModel {
    const members = new Map<number, Member3D>();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // 1. Mark supports on nodes & compute bounding box
    for (const [id, node] of nodes.entries()) {
      if (supports.has(id)) {
        node.isSupport = true;
      }
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
      minZ = Math.min(minZ, node.z);
      maxZ = Math.max(maxZ, node.z);
    }

    if (!isFinite(minX)) {
      minX = 0; maxX = 10;
      minY = 0; maxY = 10;
      minZ = 0; maxZ = 10;
    }

    let beamCount = 0;
    let columnCount = 0;

    // 2. Classify and finalize members
    for (const [id, raw] of rawMembers.entries()) {
      const startNode = raw.startNodeId ? nodes.get(raw.startNodeId) : undefined;
      const endNode = raw.endNodeId ? nodes.get(raw.endNodeId) : undefined;

      let classification: StructuralClassification = 'UNKNOWN';
      let isAutoClassified = true;

      if (startNode && endNode) {
        const dy = Math.abs(endNode.y - startNode.y);
        const dx = Math.abs(endNode.x - startNode.x);
        const dz = Math.abs(endNode.z - startNode.z);
        const horizontalLen = Math.sqrt(dx * dx + dz * dz);

        // If vertical delta is significant compared to horizontal delta -> Column
        if (dy > 0.5 && dy >= horizontalLen * 1.5) {
          classification = 'COLUMN';
          columnCount++;
        }
        // If horizontal delta dominates -> Beam
        else if (horizontalLen > 0.2 && dy < 0.2) {
          classification = 'BEAM';
          beamCount++;
        }
        // If inclined significantly -> Brace
        else if (dy > 0.2 && horizontalLen > 0.2) {
          classification = 'BRACE';
        } else {
          classification = 'BEAM';
          beamCount++;
        }
      }

      const fullMember: Member3D = {
        id,
        startNodeId: raw.startNodeId || 0,
        endNodeId: raw.endNodeId || 0,
        length: raw.length || 0,
        classification,
        isAutoClassified,
        section: raw.section || { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: '300x450 mm' },
        materialName: raw.materialName || 'CONCRETE',
        designStatus: 'NOT_DESIGNED',
      };

      members.set(id, fullMember);
    }

    // 3. Classify and normalize plates (SLAB vs WALL / Lift Core)
    for (const plate of plates.values()) {
      const pNodes = plate.nodeIds.map((nid) => nodes.get(nid)).filter(Boolean) as Node3D[];
      if (pNodes.length >= 3) {
        const yVals = pNodes.map((n) => n.y);
        const dy = Math.max(...yVals) - Math.min(...yVals);

        const v1 = {
          x: pNodes[1].x - pNodes[0].x,
          y: pNodes[1].y - pNodes[0].y,
          z: pNodes[1].z - pNodes[0].z,
        };
        const v2 = {
          x: pNodes[2].x - pNodes[0].x,
          y: pNodes[2].y - pNodes[0].y,
          z: pNodes[2].z - pNodes[0].z,
        };
        const nx = v1.y * v2.z - v1.z * v2.y;
        const ny = v1.z * v2.x - v1.x * v2.z;
        const nz = v1.x * v2.y - v1.y * v2.x;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const normalY = len > 0 ? Math.abs(ny / len) : 1;

        if (dy < 0.20 || normalY >= 0.70) {
          plate.classification = 'SLAB';
          plate.isLiftCore = false;
        } else if (dy >= 0.40 && normalY < 0.30) {
          plate.classification = 'WALL';
          plate.isLiftCore = true;
        } else {
          plate.classification = dy < 0.30 ? 'SLAB' : 'WALL';
          plate.isLiftCore = plate.classification === 'WALL';
        }
      }
    }

    return {
      nodes,
      members,
      plates,
      supports,
      loadCases,
      loadCombinations,
      reactions,
      memberForces,
      designSummaries,
      storyDrifts,
      boundingBox: {
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
      },
      statistics: {
        totalNodes: nodes.size,
        totalMembers: members.size,
        totalBeams: beamCount,
        totalColumns: columnCount,
        totalPlates: plates.size,
        totalSupports: supports.size,
        totalLoadCases: loadCases.size,
        totalCombinations: loadCombinations.size,
        maxElevation: maxY,
        baseElevation: minY,
      },
    };
  }
}
