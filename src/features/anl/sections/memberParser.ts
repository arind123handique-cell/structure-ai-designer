import { Member3D, Plate3D, Node3D } from '@/features/model/types';
import { TokenizedLine } from '../tokenizer/anlTokenizer';

export interface ParsedIncidences {
  members: Map<number, Partial<Member3D>>;
  plates: Map<number, Plate3D>;
}

export class MemberParser {
  /**
   * Parses MEMBER INCIDENCES lines.
   * Format: <memberId> <startNode> <endNode>
   * Example: "1 56 33", "2 33 69"
   */
  public static parseMemberIncidences(lines: TokenizedLine[], nodes: Map<number, Node3D>): Map<number, Partial<Member3D>> {
    const members = new Map<number, Partial<Member3D>>();

    for (const line of lines) {
      const tokens = line.tokens;
      if (tokens.length < 3) continue;

      for (let i = 0; i + 2 < tokens.length; i += 3) {
        const id = parseInt(tokens[i], 10);
        const startNodeId = parseInt(tokens[i + 1], 10);
        const endNodeId = parseInt(tokens[i + 2], 10);

        if (!isNaN(id) && !isNaN(startNodeId) && !isNaN(endNodeId)) {
          let length = 0;
          const startNode = nodes.get(startNodeId);
          const endNode = nodes.get(endNodeId);

          if (startNode && endNode) {
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          }

          members.set(id, {
            id,
            startNodeId,
            endNodeId,
            length: parseFloat(length.toFixed(3)),
            section: { type: 'RECTANGULAR' },
            materialName: 'CONCRETE',
            designStatus: 'NOT_DESIGNED',
          });
        }
      }
    }

    return members;
  }

  /**
   * Parses ELEMENT INCIDENCES SHELL lines.
   * Format: <elementId> <n1> <n2> <n3> [<n4>]
   * Example: "89 56 33 37 57", "90 34 35 74 73"
   */
  public static parseElementIncidences(lines: TokenizedLine[], nodes: Map<number, Node3D>): Map<number, Plate3D> {
    const plates = new Map<number, Plate3D>();

    for (const line of lines) {
      const tokens = line.tokens;
      if (tokens.length < 4) continue;

      let idx = 0;
      while (idx < tokens.length) {
        const id = parseInt(tokens[idx], 10);
        const n1 = parseInt(tokens[idx + 1], 10);
        const n2 = parseInt(tokens[idx + 2], 10);
        const n3 = parseInt(tokens[idx + 3], 10);

        if (isNaN(id) || isNaN(n1) || isNaN(n2) || isNaN(n3)) {
          idx++;
          continue;
        }

        const nodeIds = [n1, n2, n3];
        idx += 4;

        // Check if there's a 4th node
        if (idx < tokens.length) {
          const possibleN4 = parseInt(tokens[idx], 10);
          // If the next token is a valid node in our model and not an element ID in next sequence
          if (!isNaN(possibleN4) && nodes.has(possibleN4)) {
            nodeIds.push(possibleN4);
            idx++;
          }
        }

        // Determine if plate is SLAB (horizontal) or WALL (vertical)
        let classification: 'SLAB' | 'WALL' | 'PLATE' = 'SLAB';
        const nodeObjects = nodeIds.map((nid) => nodes.get(nid)).filter(Boolean) as Node3D[];
        if (nodeObjects.length >= 3) {
          const yVals = nodeObjects.map((n) => n.y);
          const dy = Math.max(...yVals) - Math.min(...yVals);

          // Compute plate normal vector
          const v1 = {
            x: nodeObjects[1].x - nodeObjects[0].x,
            y: nodeObjects[1].y - nodeObjects[0].y,
            z: nodeObjects[1].z - nodeObjects[0].z,
          };
          const v2 = {
            x: nodeObjects[2].x - nodeObjects[0].x,
            y: nodeObjects[2].y - nodeObjects[0].y,
            z: nodeObjects[2].z - nodeObjects[0].z,
          };
          const nx = v1.y * v2.z - v1.z * v2.y;
          const ny = v1.z * v2.x - v1.x * v2.z;
          const nz = v1.x * v2.y - v1.y * v2.x;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const normalY = len > 0 ? Math.abs(ny / len) : 1;

          // If dy is small (<0.20m) or normal is predominantly vertical -> SLAB (horizontal diaphragm)
          if (dy < 0.20 || normalY >= 0.70) {
            classification = 'SLAB';
          } else if (dy >= 0.40 && normalY < 0.30) {
            classification = 'WALL';
          } else {
            classification = dy < 0.30 ? 'SLAB' : 'WALL';
          }
        }

        plates.set(id, {
          id,
          nodeIds,
          thickness: 0.12, // default 120mm
          materialName: 'CONCRETE',
          classification,
        });
      }
    }

    return plates;
  }
}
