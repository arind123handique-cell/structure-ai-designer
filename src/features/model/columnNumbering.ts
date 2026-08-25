import { NormalizedStructuralModel, Support3D, Node3D, Member3D } from './types';

export interface ColumnSupportInfo {
  columnSlNo: number; // 1, 2, 3...
  columnLabel: string; // "C1", "C2", "C3"...
  jointLabel: string; // "C1", "C2", "C3"...
  pileCapLabel: string; // "PC-1", "PC-2", "PC-3"...
  footingLabel: string; // "F-1", "F-2", "F-3"...
  nodeId: number; // Support Node ID (e.g. 1)
  columnMemberId?: number; // Connected Ground Column Member ID
  coordinates: { x: number; y: number; z: number };
  gridLabel?: string; // e.g. "X: 0.00m, Z: 0.00m"
}

export interface ColumnMemberMappingInfo {
  memberId: number;
  columnSlNo: number; // 1, 2, 3, 4... strictly unique across all members
  columnLabel: string; // "C1", "C2", "C3", "C4"... strictly unique
  jointLabel: string; // "C1", "C2"...
  pileCapLabel?: string; // "PC-1", "PC-2"... for ground columns
  footingLabel?: string; // "F-1", "F-2"... for ground columns
  supportNodeId?: number;
  storyLevel: number; // 0 for Ground, 1 for 1st Floor, etc.
  elevationY: number;
  gridLabel: string;
}

export class ColumnNumberingService {
  /**
   * Automatically arranges and numbers all support columns in a logical spatial grid sequence.
   * Sorts ground support nodes by Z coordinate (grid rows) and X coordinate (grid bays).
   * Strict 1:1 Unified Identity: Support Joint = Ground Column Sl No = Pile Cap No (C1, C2, C3, C4...).
   */
  public static getColumnSupportMapping(
    model: NormalizedStructuralModel | null
  ): Map<number, ColumnSupportInfo> {
    const mapping = new Map<number, ColumnSupportInfo>();
    if (!model) return mapping;

    const supportList: {
      nodeId: number;
      node: Node3D;
      connectedColId?: number;
    }[] = [];

    if (!model.supports || !model.nodes || !model.members) return mapping;

    // Find all ground support nodes
    for (const [nodeId, sup] of model.supports.entries()) {
      const node = model.nodes.get(nodeId);
      if (!node) continue;

      // Find column member framing directly into this support
      let connectedColId: number | undefined;
      for (const m of model.members.values()) {
        if (
          m.classification === 'COLUMN' &&
          (m.startNodeId === nodeId || m.endNodeId === nodeId)
        ) {
          connectedColId = m.id;
          break;
        }
      }

      supportList.push({ nodeId, node, connectedColId });
    }

    // Sort ground support nodes by STAAD Node ID order so Node 1 is C1, Node 2 is C2, etc.
    supportList.sort((a, b) => a.nodeId - b.nodeId);

    // Assign sequential Column Serial Numbers starting strictly from C1: C1, C2, C3, C4...
    supportList.forEach((item, index) => {
      const slNo = index + 1;
      const columnLabel = `C${slNo}`;
      const jointLabel = `C${slNo}`;
      const pileCapLabel = `PC-${slNo}`;
      const footingLabel = `F-${slNo}`;

      mapping.set(item.nodeId, {
        columnSlNo: slNo,
        columnLabel,
        jointLabel,
        pileCapLabel,
        footingLabel,
        nodeId: item.nodeId,
        columnMemberId: item.connectedColId,
        coordinates: {
          x: parseFloat(item.node.x.toFixed(2)),
          y: parseFloat(item.node.y.toFixed(2)),
          z: parseFloat(item.node.z.toFixed(2)),
        },
        gridLabel: `X: ${item.node.x.toFixed(2)}m, Z: ${item.node.z.toFixed(2)}m`,
      });
    });

    return mapping;
  }

  /**
   * Maps every Column Member ID in the structure to a STRICTLY UNIQUE, non-repeating
   * Column Serial Number (C1, C2, C3, C4, C5, ..., Cn).
   *
   * Ordered by:
   * 1. Story elevation levels (Ground floor columns first: C1 to C21 matching Support/Pile Cap C1 to C21)
   * 2. Upper stories continue sequentially (C22 to C42, C43 to C63, C64 to C84...)
   * 3. Within each story, columns are systematically ordered by Z-grid row then X-grid bay.
   */
  public static getColumnMemberMapping(
    model: NormalizedStructuralModel | null
  ): Map<number, ColumnMemberMappingInfo> {
    const mapping = new Map<number, ColumnMemberMappingInfo>();
    if (!model) return mapping;

    const supportMapping = this.getColumnSupportMapping(model);

    // Collect all column members with spatial coordinates
    const colMembersWithCoord: {
      member: Member3D;
      avgX: number;
      minY: number;
      avgZ: number;
      connectedSupportNodeId?: number;
    }[] = [];

    if (!model.members || !model.nodes) return mapping;

    for (const col of model.members.values()) {
      if (col.classification !== 'COLUMN') continue;

      const n1 = model.nodes.get(col.startNodeId);
      const n2 = model.nodes.get(col.endNodeId);
      const avgX = n1 && n2 ? (n1.x + n2.x) / 2 : n1?.x || 0;
      const avgZ = n1 && n2 ? (n1.z + n2.z) / 2 : n1?.z || 0;
      const minY = n1 && n2 ? Math.min(n1.y, n2.y) : n1?.y || 0;

      // Check if start or end node is a ground support
      let connectedSupportNodeId: number | undefined;
      if (col.startNodeId && model.supports?.has(col.startNodeId)) {
        connectedSupportNodeId = col.startNodeId;
      } else if (col.endNodeId && model.supports?.has(col.endNodeId)) {
        connectedSupportNodeId = col.endNodeId;
      }

      colMembersWithCoord.push({
        member: col,
        avgX,
        minY,
        avgZ,
        connectedSupportNodeId,
      });
    }

    // Group into distinct story levels based on bottom elevation (minY) with 0.5m tolerance
    const storyLevels: { elevationY: number; columns: typeof colMembersWithCoord }[] = [];

    for (const colItem of colMembersWithCoord) {
      let matchedStory = storyLevels.find((s) => Math.abs(s.elevationY - colItem.minY) < 0.5);
      if (!matchedStory) {
        matchedStory = { elevationY: colItem.minY, columns: [] };
        storyLevels.push(matchedStory);
      }
      matchedStory.columns.push(colItem);
    }

    // Sort story levels from lowest elevation (Ground) to highest (Top floor)
    storyLevels.sort((a, b) => a.elevationY - b.elevationY);

    let globalSerialNo = 1;

    storyLevels.forEach((story, storyIndex) => {
      // Sort columns within this floor story:
      // If ground floor (storyIndex === 0), match ground support sorting directly
      story.columns.sort((a, b) => {
        // If both have connected supports, sort by support serial number
        if (a.connectedSupportNodeId && b.connectedSupportNodeId) {
          const slA = supportMapping.get(a.connectedSupportNodeId)?.columnSlNo || 0;
          const slB = supportMapping.get(b.connectedSupportNodeId)?.columnSlNo || 0;
          return slA - slB;
        }

        // Otherwise sort spatially by Z grid then X grid
        const zDiff = a.avgZ - b.avgZ;
        if (Math.abs(zDiff) > 0.2) return zDiff;

        const xDiff = a.avgX - b.avgX;
        if (Math.abs(xDiff) > 0.2) return xDiff;

        return a.member.id - b.member.id;
      });

      // Assign strictly UNIQUE sequential numbers: C1, C2, C3, C4, C5...
      for (const colItem of story.columns) {
        const slNo = globalSerialNo;
        const columnLabel = `C${slNo}`;
        const jointLabel = `C${slNo}`;
        const pileCapLabel = storyIndex === 0 ? `PC-${slNo}` : undefined;
        const footingLabel = storyIndex === 0 ? `F-${slNo}` : undefined;

        mapping.set(colItem.member.id, {
          memberId: colItem.member.id,
          columnSlNo: slNo,
          columnLabel,
          jointLabel,
          pileCapLabel,
          footingLabel,
          supportNodeId: colItem.connectedSupportNodeId,
          storyLevel: storyIndex,
          elevationY: parseFloat(story.elevationY.toFixed(2)),
          gridLabel: `X: ${colItem.avgX.toFixed(2)}m, Z: ${colItem.avgZ.toFixed(2)}m`,
        });

        globalSerialNo++;
      }
    });

    return mapping;
  }

  /**
   * Quick lookup for a column label given a support node ID.
   */
  public static getColumnLabel(nodeId: number, model: NormalizedStructuralModel | null): string {
    if (!model) return `C${nodeId}`;
    const mapping = this.getColumnSupportMapping(model);
    return mapping.get(nodeId)?.columnLabel || `C${nodeId}`;
  }

  /**
   * Quick lookup for a pile cap label given a support node ID.
   */
  public static getPileCapLabel(nodeId: number, model: NormalizedStructuralModel | null): string {
    if (!model) return `PC-${nodeId}`;
    const mapping = this.getColumnSupportMapping(model);
    return mapping.get(nodeId)?.pileCapLabel || `PC-${nodeId}`;
  }
}
