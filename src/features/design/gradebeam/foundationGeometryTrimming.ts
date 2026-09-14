/**
 * Foundation Grade Beam & Pile Cap Geometry Trimming Engine
 * 
 * Computes exact physical contact interfaces between grade beams, pile caps
 * (both standalone and monolithic combined/shear wall caps), and secondary tie beams.
 * 
 * Ensures grade beams begin and end precisely at the exterior faces/edges of pile caps
 * without internal penetration or overlap into solid pile cap concrete mass.
 */

export interface FoundationCapFootprint {
  nodeId?: number;
  label?: string;
  cx: number; // meters (center X)
  cz: number; // meters (center Z)
  halfX: number; // meters (half-width along X in unrotated frame)
  halfZ: number; // meters (half-depth along Z in unrotated frame)
  rotationDeg?: number;
  isCombined?: boolean;
  minX?: number; // global bounding box (for combined caps)
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  absorbedNodeIds?: number[];
}

export interface TrimmedBeamSegment {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  clearSpan: number; // in meters (distance between exterior faces)
  isSuppressed: boolean; // true if clearSpan <= 0.08m (fully swallowed) or internal to same combined cap
  startOffset: number; // distance from node 1 to face 1 (meters)
  endOffset: number; // distance from node 2 to face 2 (meters)
  midX: number;
  midZ: number;
  dirX: number;
  dirZ: number;
}

export class FoundationGeometryTrimming {
  /**
   * Trims a beam connecting (x1, z1) to (x2, z2) against the boundaries
   * of Cap 1 and Cap 2 so the beam starts and ends strictly at the exterior faces.
   */
  public static trimBeamToCapFaces(params: {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    cap1?: FoundationCapFootprint | null;
    cap2?: FoundationCapFootprint | null;
    beamWidthM?: number; // meters (default 0.3)
    isSecondary?: boolean;
    primaryBeamWidthM?: number;
  }): TrimmedBeamSegment {
    const {
      x1,
      z1,
      x2,
      z2,
      cap1,
      cap2,
      isSecondary = false,
      primaryBeamWidthM = 0.3,
    } = params;

    const dx = x2 - x1;
    const dz = z2 - z1;
    const centerToCenterDist = Math.hypot(dx, dz);

    if (centerToCenterDist < 0.001) {
      return {
        startX: x1,
        startZ: z1,
        endX: x2,
        endZ: z2,
        clearSpan: 0,
        isSuppressed: true,
        startOffset: 0,
        endOffset: 0,
        midX: x1,
        midZ: z1,
        dirX: 1,
        dirZ: 0,
      };
    }

    const ux = dx / centerToCenterDist;
    const uz = dz / centerToCenterDist;

    // Check if both nodes belong to the exact same combined/shear-wall pile cap
    if (cap1 && cap2 && cap1.isCombined && cap2.isCombined) {
      if (
        cap1 === cap2 ||
        (cap1.minX === cap2.minX && cap1.maxX === cap2.maxX && cap1.minZ === cap2.minZ && cap1.maxZ === cap2.maxZ)
      ) {
        return {
          startX: x1,
          startZ: z1,
          endX: x2,
          endZ: z2,
          clearSpan: 0,
          isSuppressed: true,
          startOffset: 0,
          endOffset: 0,
          midX: (x1 + x2) / 2,
          midZ: (z1 + z2) / 2,
          dirX: ux,
          dirZ: uz,
        };
      }
    }

    // 1. Calculate ray intersection distance from (x1, z1) along (ux, uz) to face of Cap 1
    let d1 = 0;
    if (cap1) {
      d1 = this.computeRayIntersectionDistance(x1, z1, ux, uz, cap1);
    } else if (isSecondary) {
      // Framing into primary grade beam side face
      d1 = primaryBeamWidthM / 2;
    } else {
      // Default column face distance
      d1 = 0.225;
    }

    // 2. Calculate ray intersection distance from (x2, z2) along (-ux, -uz) to face of Cap 2
    let d2 = 0;
    if (cap2) {
      d2 = this.computeRayIntersectionDistance(x2, z2, -ux, -uz, cap2);
    } else if (isSecondary) {
      d2 = primaryBeamWidthM / 2;
    } else {
      d2 = 0.225;
    }

    // Ensure offsets are non-negative and don't exceed center-to-center distance
    d1 = Math.max(0, d1);
    d2 = Math.max(0, d2);

    const clearSpan = centerToCenterDist - d1 - d2;
    const isSuppressed = clearSpan <= 0.08;

    const startX = isSuppressed ? x1 : x1 + d1 * ux;
    const startZ = isSuppressed ? z1 : z1 + d1 * uz;
    const endX = isSuppressed ? x2 : x2 - d2 * ux;
    const endZ = isSuppressed ? z2 : z2 - d2 * uz;

    return {
      startX,
      startZ,
      endX,
      endZ,
      clearSpan: Math.max(0, parseFloat(clearSpan.toFixed(3))),
      isSuppressed,
      startOffset: parseFloat(d1.toFixed(3)),
      endOffset: parseFloat(d2.toFixed(3)),
      midX: (startX + endX) / 2,
      midZ: (startZ + endZ) / 2,
      dirX: ux,
      dirZ: uz,
    };
  }

  /**
   * Computes the distance from point (px, pz) along ray (dirX, dirZ) to the perimeter face of the cap.
   */
  private static computeRayIntersectionDistance(
    px: number,
    pz: number,
    dirX: number,
    dirZ: number,
    cap: FoundationCapFootprint
  ): number {
    // A. Combined / Shear Wall Monolithic Cap (using bounding box or physical envelope)
    if (cap.isCombined && cap.minX !== undefined && cap.maxX !== undefined && cap.minZ !== undefined && cap.maxZ !== undefined) {
      let tx = Infinity;
      if (dirX > 1e-5) {
        tx = (cap.maxX - px) / dirX;
      } else if (dirX < -1e-5) {
        tx = (cap.minX - px) / dirX;
      }

      let tz = Infinity;
      if (dirZ > 1e-5) {
        tz = (cap.maxZ - pz) / dirZ;
      } else if (dirZ < -1e-5) {
        tz = (cap.minZ - pz) / dirZ;
      }

      const validT: number[] = [];
      if (tx >= 0 && Number.isFinite(tx)) validT.push(tx);
      if (tz >= 0 && Number.isFinite(tz)) validT.push(tz);

      if (validT.length > 0) {
        return Math.min(...validT);
      }
      return Math.min(cap.halfX, cap.halfZ);
    }

    // B. Standalone Pile Cap (Rectangular, Rotated, or Polygonal)
    const rotRad = ((cap.rotationDeg || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // Transform ray into cap's local coordinate system
    const relX = px - cap.cx;
    const relZ = pz - cap.cz;

    const locPx = relX * cosR + relZ * sinR;
    const locPz = -relX * sinR + relZ * cosR;

    const locDirX = dirX * cosR + dirZ * sinR;
    const locDirZ = -dirX * sinR + dirZ * cosR;

    const hx = cap.halfX > 0 ? cap.halfX : 0.6;
    const hz = cap.halfZ > 0 ? cap.halfZ : 0.6;

    let tx = Infinity;
    if (locDirX > 1e-5) {
      tx = (hx - locPx) / locDirX;
    } else if (locDirX < -1e-5) {
      tx = (-hx - locPx) / locDirX;
    }

    let tz = Infinity;
    if (locDirZ > 1e-5) {
      tz = (hz - locPz) / locDirZ;
    } else if (locDirZ < -1e-5) {
      tz = (-hz - locPz) / locDirZ;
    }

    const validT: number[] = [];
    if (tx >= 0 && Number.isFinite(tx)) validT.push(tx);
    if (tz >= 0 && Number.isFinite(tz)) validT.push(tz);

    if (validT.length > 0) {
      return Math.min(...validT);
    }

    return Math.min(hx, hz);
  }
}
