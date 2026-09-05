// @ts-nocheck
/**
 * Reinforcement3DRenderer — builds 3D rebar meshes (longitudinal bars + ties/stirrups)
 * for structural members, in the member's LOCAL frame:
 *   - local Y = member axis (node1 -> node2)
 *   - local X = section width  b
 *   - local Z = section depth  D
 *
 * Meshes are returned inside a Group that the caller orients with the same
 * quaternion used for the concrete member mesh (align local Y to member dir).
 *
 * This mirrors how the concrete box is built: BoxGeometry(b, length, D).
 */
import * as THREE from 'three';

const BAR_RADIUS_MULT = 0.5; // bars rendered slightly enlarged for visibility
const DEFAULT_COVER_MM = 40;
const COLUMN_TIE_SPACING_M = 0.2;
const MAX_TIES = 400; // safety cap on tie/ring loops per member

interface BarPos { x: number; z: number }

/**
 * Shared geometries & materials for a SINGLE effect run (build pass).
 * The viewer creates one `ReinforcementShared` per rebuild and disposes it after,
 * keeping disposal safe even though each pass disposes the whole dynamic group.
 */
export interface ReinforcementShared {
  barRadius: number;
  barGeom: THREE.CylinderGeometry;
  barMat: THREE.MeshStandardMaterial;
  tieMat: THREE.LineBasicMaterial;
}

export function createReinforcementShared(barRadius: number): ReinforcementShared {
  return {
    barRadius,
    barGeom: new THREE.CylinderGeometry(barRadius, barRadius, 1, 6),
    barMat: new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // amber/gold rebar
      roughness: 0.3,
      metalness: 0.85,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    }),
    tieMat: new THREE.LineBasicMaterial({ color: 0x38bdf8 }), // cyan ties
  };
}

/** Cursorally dispose a shared resource set (idempotent). */
export function disposeReinforcementShared(shared: ReinforcementShared | null) {
  if (!shared) return;
  shared.barGeom.dispose();
  shared.barMat.dispose();
  shared.tieMat.dispose();
}

/**
 * Build a single longitudinal bar as a cylinder spanning the full local Y axis.
 */
function buildBar(length: number, x: number, z: number, shared: ReinforcementShared): THREE.Mesh {
  const mesh = new THREE.Mesh(shared.barGeom, shared.barMat);
  mesh.scale.set(1, length, 1);
  mesh.position.set(x, 0, z);
  return mesh;
}

/**
 * Generate the perimeter bar positions for a column/rectangular section.
 * cornerBars (4) + faceBars {countX (along D / Z), countY (along b / X)}.
 */
function columnBarPositions(b: number, D: number, inset: number, faceBars?: any): BarPos[] {
  const pts: BarPos[] = [];
  const hw = b / 2 - inset;
  const hd = D / 2 - inset;

  // corners
  pts.push({ x: -hw, z: -hd }, { x: hw, z: -hd }, { x: hw, z: hd }, { x: -hw, z: hd });

  const nx = faceBars?.countX || 0; // along D faces (x = ±hw)
  const ny = faceBars?.countY || 0; // along b faces (z = ±hd)

  // intermediate bars on depth faces (x = ±hw), spread across z
  if (nx > 0) {
    for (let i = 1; i <= nx; i++) {
      const z = -hd + (i * 2 * hd) / (nx + 1);
      pts.push({ x: -hw, z }, { x: hw, z });
    }
  }
  // intermediate bars on width faces (z = ±hd), spread across x
  if (ny > 0) {
    for (let i = 1; i <= ny; i++) {
      const x = -hw + (i * 2 * hw) / (ny + 1);
      pts.push({ x, z: -hd }, { x, z: hd });
    }
  }
  return pts;
}

/**
 * Spread `count` bars evenly across a face spanning width `w` between -hw..hw.
 */
function spreadBars(count: number, hw: number, inset: number, fixedZ: number): BarPos[] {
  const pts: BarPos[] = [];
  if (count <= 0) return pts;
  if (count === 1) {
    pts.push({ x: 0, z: fixedZ });
    return pts;
  }
  const usable = 2 * (hw - inset);
  const gap = usable / (count - 1);
  for (let i = 0; i < count; i++) {
    pts.push({ x: -hw + inset + i * gap, z: fixedZ });
  }
  return pts;
}

/** Build column longitudinal bars down the perimeter. */
function buildColumnBars(length: number, b: number, D: number, rebar: any, coverMm: number, radius: number, shared: ReinforcementShared, group: THREE.Group) {
  const face = rebar?.faceBars;
  const inset = (coverMm / 1000) + radius - 0.004;
  const pts = columnBarPositions(b, D, inset, face);
  pts.forEach((p) => group.add(buildBar(length, p.x, p.z, shared)));
}

/** Build column ties (rectangular rings) at regular spacing along length. */
function buildColumnTies(length: number, b: number, D: number, coverMm: number, radius: number, shared: ReinforcementShared, group: THREE.Group) {
  const inset = (coverMm / 1000) + radius - 0.004;
  const hw = b / 2 - inset;
  const hd = D / 2 - inset;
  const nTies = Math.min(MAX_TIES, Math.max(1, Math.round(length / COLUMN_TIE_SPACING_M)));
  const pts = [
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hw, 0, -hd),
  ];
  for (let i = 0; i <= nTies; i += 1) {
    const y = -length / 2 + (length * i) / nTies;
    const geom = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, y, p.z)));
    group.add(new THREE.Line(geom, shared.tieMat));
  }
}

/** Build beam main (top/bottom) bars spanning length. */
function buildBeamBars(length: number, b: number, D: number, topBars: any[], bottomBars: any[], coverMm: number, radius: number, shared: ReinforcementShared, group: THREE.Group) {
  const inset = (coverMm / 1000) + radius - 0.004;
  const hw = b / 2;
  const topZ = -(D / 2 - inset);
  const botZ = (D / 2 - inset);

  const place = (bars: any[], fixedZ: number) => {
    if (!bars) return;
    for (const layer of bars) {
      const count = layer?.count || 0;
      if (count <= 0) continue;
      spreadBars(count, hw, inset, fixedZ).forEach((p) => group.add(buildBar(length, p.x, p.z, shared)));
    }
  };
  place(topBars, topZ);
  place(bottomBars, botZ);
}

/** Build beam stirrups (vertical rectangular loops) at shear spacing. */
function buildBeamStirrups(length: number, b: number, D: number, spacingMm: number, coverMm: number, shared: ReinforcementShared, group: THREE.Group) {
  const spacing = Math.max(0.075, (spacingMm || 150) / 1000);
  const inset = (coverMm / 1000) + 0.004;
  const hw = b / 2 - inset;
  const hd = D / 2 - inset;
  const n = Math.min(MAX_TIES, Math.max(1, Math.round(length / spacing)));
  const pts = [
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hw, 0, -hd),
  ];
  for (let i = 0; i <= n; i += 1) {
    const y = -length / 2 + (length * i) / n;
    const geom = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, y, p.z)));
    group.add(new THREE.Line(geom, shared.tieMat));
  }
}

export interface ReinforcementSpec {
  memberId: number;
  isColumn: boolean;
  b: number; // m
  D: number; // m
  length: number; // m
  coverMm?: number;
  columnRebar?: any;          // savedColumnDesigns[mid].rebar
  beamTopBars?: any[];        // topRebar.bars:[{diameter,count}]
  beamBottomBars?: any[];     // bottomRebar.bars
  stirrupSpacingMm?: number;
  stirrupDiameterMm?: number;
}

export interface ReinforcementRenderOptions {
  showColumnBars: boolean;
  showColumnTies: boolean;
  showBeamBars: boolean;
  showBeamStirrups: boolean;
}

function barRadiusFor(diaMm: number): number {
  return ((diaMm / 1000) / 2) * BAR_RADIUS_MULT + 0.004;
}

/**
 * Build the full reinforcement group for one member in local coordinates.
 * Uses a caller-owned `shared` resource set (one per effect run) so disposal is safe.
 * Returns null if nothing should render.
 */
export function buildMemberReinforcement(
  spec: ReinforcementSpec,
  opts: ReinforcementRenderOptions,
  shared: ReinforcementShared
): THREE.Group | null {
  const group = new THREE.Group();
  const cover = spec.coverMm ?? (spec.isColumn ? DEFAULT_COVER_MM : 30);

  if (spec.isColumn) {
    const rebar = spec.columnRebar;
    const dia = rebar?.cornerBars?.diameter || 16;
    const radius = barRadiusFor(dia);
    if (opts.showColumnBars && rebar?.cornerBars) {
      buildColumnBars(spec.length, spec.b, spec.D, rebar, cover, radius, shared, group);
    }
    if (opts.showColumnTies) {
      buildColumnTies(spec.length, spec.b, spec.D, cover, radius, shared, group);
    }
  } else {
    const dia = (spec.beamTopBars?.[0]?.diameter) || (spec.beamBottomBars?.[0]?.diameter) || 16;
    const radius = barRadiusFor(dia);
    if (opts.showBeamBars) {
      buildBeamBars(spec.length, spec.b, spec.D, spec.beamTopBars, spec.beamBottomBars, cover, radius, shared, group);
    }
    if (opts.showBeamStirrups) {
      buildBeamStirrups(spec.length, spec.b, spec.D, spec.stirrupSpacingMm || 150, cover, shared, group);
    }
  }

  if (group.children.length === 0) return null;

  // Tag every rebar rod/ring with the owning member so clicks select the member.
  group.userData.memberId = spec.memberId;
  group.userData.rfType = 'rebar';
  group.traverse((obj) => {
    obj.userData.memberId = spec.memberId;
    obj.userData.rfType = 'rebar';
  });

  return group;
}
