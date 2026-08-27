/**
 * Parametric Architectural Room Detection and Management Engine
 */

import {
  ArchitecturalRoom,
  ArchitecturalWall,
  Point2D,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';

interface GraphNode {
  id: number;
  point: Point2D;
  edges: number[]; // neighbor node indices
}

function normalizeAngle(rad: number): number {
  const twoPi = 2 * Math.PI;
  const a = rad % twoPi;
  return a < 0 ? a + twoPi : a;
}

export class RoomEngine {
  /**
   * Automatically detect all enclosed room boundaries formed by walls on a floor
   */
  public static detectRoomsFromWalls(
    walls: ArchitecturalWall[],
    floorId: string,
    existingRoomIds: string[] = []
  ): ArchitecturalRoom[] {
    if (walls.length < 3) return [];

    // 1. Collect all valid wall segments
    const rawSegments: { p1: Point2D; p2: Point2D }[] = [];
    for (const w of walls) {
      if (ArchitecturalGeometryEngine.distance(w.start, w.end) > 0.05) {
        rawSegments.push({ p1: { ...w.start }, p2: { ...w.end } });
      }
    }

    if (rawSegments.length < 3) return [];

    // 2. Find all intersection points AND T-junction endpoints on each segment
    const splitPointsMap: Point2D[][] = rawSegments.map(() => []);

    for (let i = 0; i < rawSegments.length; i++) {
      const s1 = rawSegments[i];

      for (let j = 0; j < rawSegments.length; j++) {
        if (i === j) continue;
        const s2 = rawSegments[j];

        // 2a. Line-Line finite segment intersection
        const inter = ArchitecturalGeometryEngine.lineIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
        if (inter) {
          if (!ArchitecturalGeometryEngine.pointEquals(inter, s1.p1, 0.03) &&
              !ArchitecturalGeometryEngine.pointEquals(inter, s1.p2, 0.03)) {
            splitPointsMap[i].push(inter);
          }
        }

        // 2b. T-Junctions: Endpoint of s2 landing along s1
        const proj1 = ArchitecturalGeometryEngine.projectPointToSegment(s2.p1, s1.p1, s1.p2);
        if (proj1.isInsideSegment && proj1.distance < 0.05 && proj1.t > 0.01 && proj1.t < 0.99) {
          splitPointsMap[i].push(proj1.point);
        }

        const proj2 = ArchitecturalGeometryEngine.projectPointToSegment(s2.p2, s1.p1, s1.p2);
        if (proj2.isInsideSegment && proj2.distance < 0.05 && proj2.t > 0.01 && proj2.t < 0.99) {
          splitPointsMap[i].push(proj2.point);
        }
      }
    }

    // 3. Subdivide segments into atomic sub-segments
    const subSegments: { p1: Point2D; p2: Point2D }[] = [];
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const splits = splitPointsMap[i];

      // Deduplicate split points on the segment
      const uniqueSplits: Point2D[] = [];
      for (const sp of splits) {
        if (!uniqueSplits.some((u) => ArchitecturalGeometryEngine.pointEquals(u, sp, 0.03))) {
          uniqueSplits.push(sp);
        }
      }

      // Sort split points along segment direction
      uniqueSplits.sort((a, b) => {
        const da = ArchitecturalGeometryEngine.distance(seg.p1, a);
        const db = ArchitecturalGeometryEngine.distance(seg.p1, b);
        return da - db;
      });

      const chain = [seg.p1, ...uniqueSplits, seg.p2];
      for (let k = 0; k < chain.length - 1; k++) {
        if (ArchitecturalGeometryEngine.distance(chain[k], chain[k + 1]) > 0.05) {
          subSegments.push({ p1: chain[k], p2: chain[k + 1] });
        }
      }
    }

    // 4. Build planar graph nodes
    const nodes: GraphNode[] = [];
    const findOrCreateNode = (pt: Point2D): number => {
      for (let idx = 0; idx < nodes.length; idx++) {
        if (ArchitecturalGeometryEngine.pointEquals(nodes[idx].point, pt, 0.04)) {
          return idx;
        }
      }
      const newIdx = nodes.length;
      nodes.push({ id: newIdx, point: { ...pt }, edges: [] });
      return newIdx;
    };

    for (const sub of subSegments) {
      const u = findOrCreateNode(sub.p1);
      const v = findOrCreateNode(sub.p2);
      if (u !== v) {
        if (!nodes[u].edges.includes(v)) nodes[u].edges.push(v);
        if (!nodes[v].edges.includes(u)) nodes[v].edges.push(u);
      }
    }

    // 5. Build directed half-edges
    interface HalfEdge {
      u: number;
      v: number;
      angle: number; // normalized [0, 2PI)
      visited: boolean;
    }

    const halfEdges: HalfEdge[] = [];
    for (let u = 0; u < nodes.length; u++) {
      for (const v of nodes[u].edges) {
        const rad = Math.atan2(nodes[v].point.y - nodes[u].point.y, nodes[v].point.x - nodes[u].point.x);
        halfEdges.push({ u, v, angle: normalizeAngle(rad), visited: false });
      }
    }

    // Sort outgoing edges around each node in counterclockwise order (increasing angle)
    const nodeOutgoingEdges: Map<number, HalfEdge[]> = new Map();
    for (let u = 0; u < nodes.length; u++) {
      const out = halfEdges.filter((e) => e.u === u);
      out.sort((a, b) => a.angle - b.angle);
      nodeOutgoingEdges.set(u, out);
    }

    // 6. Traverse planar faces
    const candidateFaces: Point2D[][] = [];

    for (const edge of halfEdges) {
      if (edge.visited) continue;

      const pathEdges: HalfEdge[] = [];
      const faceVertices: Point2D[] = [];
      let currentEdge: HalfEdge | undefined = edge;
      let isLoop = false;
      const maxSteps = nodes.length * 2 + 10;
      let steps = 0;

      while (currentEdge && !pathEdges.includes(currentEdge) && steps < maxSteps) {
        pathEdges.push(currentEdge);
        faceVertices.push(nodes[currentEdge.u].point);
        steps++;

        const nextU: number = currentEdge.v;
        if (nextU === edge.u) {
          isLoop = true;
          break;
        }

        const outEdges: HalfEdge[] = nodeOutgoingEdges.get(nextU) || [];
        if (outEdges.length === 0) break;

        // Find incoming reverse edge index (the edge pointing back to currentEdge.u)
        let revIndex = -1;
        for (let i = 0; i < outEdges.length; i++) {
          if (outEdges[i].v === currentEdge.u) {
            revIndex = i;
            break;
          }
        }

        if (revIndex === -1) {
          // If direct reverse edge not found, fallback to angle closest to revAngle
          const revAngle = normalizeAngle(currentEdge.angle + Math.PI);
          let bestIdx = 0;
          let minDiff = Infinity;
          for (let i = 0; i < outEdges.length; i++) {
            const diff = Math.abs(outEdges[i].angle - revAngle);
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = i;
            }
          }
          revIndex = bestIdx;
        }

        // The edge preceding revIndex in CCW order turns sharpest left into the face
        const nextIdx = (revIndex - 1 + outEdges.length) % outEdges.length;
        currentEdge = outEdges[nextIdx];
      }

      if (isLoop && faceVertices.length >= 3) {
        // Mark all edges of the loop as visited
        pathEdges.forEach((e) => {
          e.visited = true;
        });

        // Calculate signed Shoelace area
        let signedArea = 0;
        for (let i = 0; i < faceVertices.length; i++) {
          const j = (i + 1) % faceVertices.length;
          signedArea += faceVertices[i].x * faceVertices[j].y - faceVertices[j].x * faceVertices[i].y;
        }
        signedArea /= 2;

        // CCW traversal of interior faces yields signedArea > 0
        if (signedArea >= 0.5 && signedArea <= 2500) {
          candidateFaces.push(faceVertices);
        }
      } else {
        edge.visited = true;
      }
    }

    // 7. Filter duplicates and construct ArchitecturalRoom items
    const rooms: ArchitecturalRoom[] = [];
    const discoveredPolygons: Point2D[][] = [];

    for (const face of candidateFaces) {
      const area = ArchitecturalGeometryEngine.polygonArea(face);
      const centroid = ArchitecturalGeometryEngine.polygonCentroid(face);

      const isDuplicate = discoveredPolygons.some((poly) => {
        const c = ArchitecturalGeometryEngine.polygonCentroid(poly);
        return ArchitecturalGeometryEngine.distance(c, centroid) < 0.25;
      });

      if (!isDuplicate) {
        discoveredPolygons.push(face);
        const perimeter = ArchitecturalGeometryEngine.polygonPerimeter(face);
        const id = ArchitecturalIdGenerator.generateRoomId([...existingRoomIds, ...rooms.map((r) => r.id)]);
        const roomNum = rooms.length + 1;

        rooms.push({
          id,
          floorId,
          name: `ROOM ${String(roomNum).padStart(2, '0')}`,
          roomType: 'LIVING_OR_BEDROOM',
          boundary: face,
          area: parseFloat(area.toFixed(2)),
          perimeter: parseFloat(perimeter.toFixed(2)),
          labelPosition: centroid,
        });
      }
    }

    return rooms;
  }

  /**
   * Create a manual room with designated polygon boundary
   */
  public static createRoom(
    name: string,
    boundary: Point2D[],
    floorId: string,
    existingRoomIds: string[] = [],
    roomType = 'CUSTOM'
  ): ArchitecturalRoom {
    const id = ArchitecturalIdGenerator.generateRoomId(existingRoomIds);
    const area = parseFloat(ArchitecturalGeometryEngine.polygonArea(boundary).toFixed(2));
    const perimeter = parseFloat(ArchitecturalGeometryEngine.polygonPerimeter(boundary).toFixed(2));
    const centroid = ArchitecturalGeometryEngine.polygonCentroid(boundary);

    return {
      id,
      floorId,
      name,
      roomType,
      boundary,
      area,
      perimeter,
      labelPosition: centroid,
    };
  }
}
