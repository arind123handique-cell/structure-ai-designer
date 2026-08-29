/**
 * High-Performance Three.js 3D Layer for Architectural & Structural BIM Elements
 * Real-time 3D Walls, Segmented Openings, 3D Doors & Windows, 3D RCC Staircases, and Cached Sprites
 */

import * as THREE from 'three';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  ArchitecturalStaircase,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from '../engines/architecturalGeometryEngine';
import { StaircasePlacementEngine } from '../engines/staircasePlacementEngine';
import { DiaphragmLevelInfo } from '@/features/design/staircase/staircaseEngine';

// Global texture cache to prevent creating duplicate textures / canvases across renders
const badgeTextureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateBadgeTexture(
  title: string,
  subtitle?: string,
  bgColor = '#1e293b',
  borderColor = '#64748b'
): THREE.CanvasTexture {
  const cacheKey = `${title}__${subtitle || ''}__${bgColor}__${borderColor}`;
  if (badgeTextureCache.has(cacheKey)) {
    return badgeTextureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 70;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext ? canvas.getContext('2d') : null;
  } catch (e) {
    ctx = null;
  }

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = 12;
    const x = 4;
    const y = 4;
    const w = canvas.width - 8;
    const h = canvas.height - 8;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (subtitle) {
      ctx.fillText(title, canvas.width / 2, 28);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(subtitle, canvas.width / 2, 48);
    } else {
      ctx.fillText(title, canvas.width / 2, canvas.height / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  badgeTextureCache.set(cacheKey, texture);
  return texture;
}

function createTextBadge(
  title: string,
  subtitle?: string,
  bgColor = '#1e293b',
  borderColor = '#64748b'
): THREE.Sprite {
  const texture = getOrCreateBadgeTexture(title, subtitle, bgColor, borderColor);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.7, 1);
  return sprite;
}

function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m: any) => {
          if (m.map && !badgeTextureCache.has(m.map.name)) {
            // Keep cached canvas textures
          }
          m.dispose();
        });
      } else {
        child.material.dispose();
      }
    }
  });
}

export interface Architectural3DVisibility {
  showWalls: boolean;
  showDoors: boolean;
  showWindows: boolean;
  showOpenings: boolean;
  showRoomLabels: boolean;
  showStaircases: boolean;
  diaphragmLevels?: DiaphragmLevelInfo[];
}

export class Architectural3DLayer {
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ArchitecturalBIMLayer';
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public update(
    walls: Record<string, ArchitecturalWall>,
    doors: Record<string, ArchitecturalDoor>,
    windows: Record<string, ArchitecturalWindow>,
    openings: Record<string, ArchitecturalOpening>,
    rooms: Record<string, ArchitecturalRoom>,
    staircasesOrSelectedId?: Record<string, ArchitecturalStaircase> | string | null,
    selectedIdOrVisibility?: string | Architectural3DVisibility | null,
    visibilityParam?: Architectural3DVisibility
  ) {
    // Clear previous objects
    disposeHierarchy(this.group);
    this.group.clear();

    let staircases: Record<string, ArchitecturalStaircase> = {};
    let selectedId: string | null = null;
    let visibility: Architectural3DVisibility = {
      showWalls: true,
      showDoors: true,
      showWindows: true,
      showOpenings: true,
      showRoomLabels: true,
      showStaircases: true,
    };

    if (staircasesOrSelectedId && typeof staircasesOrSelectedId === 'object') {
      staircases = staircasesOrSelectedId as Record<string, ArchitecturalStaircase>;
      if (typeof selectedIdOrVisibility === 'string' || selectedIdOrVisibility === null) {
        selectedId = selectedIdOrVisibility as string | null;
      }
      if (visibilityParam) {
        visibility = { ...visibility, ...visibilityParam };
      }
    } else {
      if (typeof staircasesOrSelectedId === 'string' || staircasesOrSelectedId === null) {
        selectedId = staircasesOrSelectedId;
      }
      if (selectedIdOrVisibility && typeof selectedIdOrVisibility === 'object') {
        visibility = { ...visibility, ...(selectedIdOrVisibility as any) };
      }
    }

    const wallList = Object.values(walls || {});
    const doorList = Object.values(doors || {});
    const windowList = Object.values(windows || {});
    const openingList = Object.values(openings || {});
    const roomList = Object.values(rooms || {});
    const stairList = Object.values(staircases || {});

    // Shared Base Materials
    const externalWallMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Slate Architectural Wall
      roughness: 0.6,
      metalness: 0.05,
    });
    const internalWallMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.65,
      metalness: 0.05,
    });
    const selectedWallMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Warm timber
      roughness: 0.4,
    });
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.45,
    });
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Dark aluminum
      roughness: 0.3,
      metalness: 0.5,
    });
    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.8,
    });

    // Staircase Materials
    const stairConcreteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // RCC Concrete Steps
      roughness: 0.55,
      metalness: 0.08,
    });
    const stairLandingMat = new THREE.MeshStandardMaterial({
      color: 0x4f46e5, // Floor Landing Slab (Indigo)
      roughness: 0.45,
      metalness: 0.15,
    });
    const stairMidLandingMat = new THREE.MeshStandardMaterial({
      color: 0x059669, // Mid-Landing Slab (Emerald)
      roughness: 0.45,
      metalness: 0.15,
    });
    const stairRailingMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Stainless steel / anodized aluminum handrail
      roughness: 0.25,
      metalness: 0.85,
    });
    const stairEnclosureWallMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // 230mm Enclosure Wall
      roughness: 0.7,
      metalness: 0.05,
    });

    // 1. Build 3D Walls with Segmented Openings
    if (visibility.showWalls) {
      for (const wall of wallList) {
        const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
        if (wallLen < 0.05) continue;

        const isWallSelected = selectedId === wall.id;
        const baseMat = isWallSelected
          ? selectedWallMat
          : wall.wallType === 'INTERNAL'
          ? internalWallMat
          : externalWallMat;

        interface WallOpeningDef {
          id: string;
          type: 'DOOR' | 'WINDOW' | 'OPENING';
          pos: number;
          width: number;
          height: number;
          sill: number;
          ref: any;
        }

        const hostedList: WallOpeningDef[] = [];

        if (visibility.showDoors) {
          doorList
            .filter((d) => d.hostWallId === wall.id)
            .forEach((d) => {
              hostedList.push({
                id: d.id,
                type: 'DOOR',
                pos: d.position,
                width: d.width,
                height: d.height,
                sill: d.sillHeight,
                ref: d,
              });
            });
        }

        if (visibility.showWindows) {
          windowList
            .filter((w) => w.hostWallId === wall.id)
            .forEach((w) => {
              hostedList.push({
                id: w.id,
                type: 'WINDOW',
                pos: w.position,
                width: w.width,
                height: w.height,
                sill: w.sillHeight,
                ref: w,
              });
            });
        }

        if (visibility.showOpenings) {
          openingList
            .filter((o) => o.hostWallId === wall.id)
            .forEach((o) => {
              hostedList.push({
                id: o.id,
                type: 'OPENING',
                pos: o.position,
                width: o.width,
                height: o.height,
                sill: o.sillHeight,
                ref: o,
              });
            });
        }

        hostedList.sort((a, b) => a.pos - b.pos);

        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const wallElevation = wall.baseElevation;
        const wallH = wall.height;
        const wallThick = wall.thickness;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(wall.start.x, wallElevation, wall.start.y);

        const angle = Math.atan2(dy, dx);
        wallGroup.rotation.y = -angle;

        if (hostedList.length === 0) {
          const geom = new THREE.BoxGeometry(wallLen, wallH, wallThick);
          const mesh = new THREE.Mesh(geom, baseMat);
          mesh.position.set(wallLen / 2, wallH / 2, 0);
          mesh.userData = { type: 'arch_wall', id: wall.id };
          wallGroup.add(mesh);

          const edges = new THREE.EdgesGeometry(geom);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
              color: isWallSelected ? 0xfde047 : 0x475569,
            })
          );
          line.position.copy(mesh.position);
          wallGroup.add(line);
        } else {
          let currentU = 0;

          for (const op of hostedList) {
            const opStartU = Math.max(0, op.pos - op.width / 2);
            const opEndU = Math.min(wallLen, op.pos + op.width / 2);

            if (opStartU > currentU + 0.01) {
              const segLen = opStartU - currentU;
              const geom = new THREE.BoxGeometry(segLen, wallH, wallThick);
              const mesh = new THREE.Mesh(geom, baseMat);
              mesh.position.set(currentU + segLen / 2, wallH / 2, 0);
              mesh.userData = { type: 'arch_wall', id: wall.id };
              wallGroup.add(mesh);

              const edges = new THREE.EdgesGeometry(geom);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: isWallSelected ? 0xfde047 : 0x475569 })
              );
              line.position.copy(mesh.position);
              wallGroup.add(line);
            }

            const opActualW = opEndU - opStartU;

            if (op.sill > 0.05) {
              const sillH = op.sill;
              const geom = new THREE.BoxGeometry(opActualW, sillH, wallThick);
              const mesh = new THREE.Mesh(geom, baseMat);
              mesh.position.set(opStartU + opActualW / 2, sillH / 2, 0);
              mesh.userData = { type: 'arch_wall', id: wall.id };
              wallGroup.add(mesh);

              const edges = new THREE.EdgesGeometry(geom);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: isWallSelected ? 0xfde047 : 0x475569 })
              );
              line.position.copy(mesh.position);
              wallGroup.add(line);
            }

            const opTop = op.sill + op.height;
            if (wallH > opTop + 0.05) {
              const lintelH = wallH - opTop;
              const geom = new THREE.BoxGeometry(opActualW, lintelH, wallThick);
              const mesh = new THREE.Mesh(geom, baseMat);
              mesh.position.set(opStartU + opActualW / 2, opTop + lintelH / 2, 0);
              mesh.userData = { type: 'arch_wall', id: wall.id };
              wallGroup.add(mesh);

              const edges = new THREE.EdgesGeometry(geom);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: isWallSelected ? 0xfde047 : 0x475569 })
              );
              line.position.copy(mesh.position);
              wallGroup.add(line);
            }

            if (op.type === 'DOOR') {
              const isDoorSelected = selectedId === op.id;
              const doorGroup = new THREE.Group();
              doorGroup.position.set(opStartU + opActualW / 2, op.sill, 0);

              const frameThick = 0.06;
              const frameDepth = wallThick + 0.02;
              const leftPost = new THREE.Mesh(
                new THREE.BoxGeometry(frameThick, op.height, frameDepth),
                doorFrameMat
              );
              leftPost.position.set(-opActualW / 2 + frameThick / 2, op.height / 2, 0);
              doorGroup.add(leftPost);

              const rightPost = new THREE.Mesh(
                new THREE.BoxGeometry(frameThick, op.height, frameDepth),
                doorFrameMat
              );
              rightPost.position.set(opActualW / 2 - frameThick / 2, op.height / 2, 0);
              doorGroup.add(rightPost);

              const topPost = new THREE.Mesh(
                new THREE.BoxGeometry(opActualW, frameThick, frameDepth),
                doorFrameMat
              );
              topPost.position.set(0, op.height - frameThick / 2, 0);
              doorGroup.add(topPost);

              const leafW = opActualW - frameThick * 2;
              const leafH = op.height - frameThick;
              const leafThick = 0.04;
              const leafGeom = new THREE.BoxGeometry(leafW, leafH, leafThick);
              const leafMesh = new THREE.Mesh(
                leafGeom,
                isDoorSelected ? selectedWallMat : doorLeafMat
              );
              leafMesh.position.set(0, leafH / 2, 0);
              leafMesh.userData = { type: 'arch_door', id: op.id };
              doorGroup.add(leafMesh);

              wallGroup.add(doorGroup);
            }

            if (op.type === 'WINDOW') {
              const isWinSelected = selectedId === op.id;
              const winGroup = new THREE.Group();
              winGroup.position.set(opStartU + opActualW / 2, op.sill, 0);

              const frameThick = 0.05;
              const frameDepth = wallThick + 0.01;

              const topF = new THREE.Mesh(
                new THREE.BoxGeometry(opActualW, frameThick, frameDepth),
                windowFrameMat
              );
              topF.position.set(0, op.height - frameThick / 2, 0);
              winGroup.add(topF);

              const botF = new THREE.Mesh(
                new THREE.BoxGeometry(opActualW, frameThick, frameDepth),
                windowFrameMat
              );
              botF.position.set(0, frameThick / 2, 0);
              winGroup.add(botF);

              const leftF = new THREE.Mesh(
                new THREE.BoxGeometry(frameThick, op.height, frameDepth),
                windowFrameMat
              );
              leftF.position.set(-opActualW / 2 + frameThick / 2, op.height / 2, 0);
              winGroup.add(leftF);

              const rightF = new THREE.Mesh(
                new THREE.BoxGeometry(frameThick, op.height, frameDepth),
                windowFrameMat
              );
              rightF.position.set(opActualW / 2 - frameThick / 2, op.height / 2, 0);
              winGroup.add(rightF);

              const glassW = opActualW - frameThick * 2;
              const glassH = op.height - frameThick * 2;
              const glassMesh = new THREE.Mesh(
                new THREE.BoxGeometry(glassW, glassH, 0.012),
                isWinSelected ? selectedWallMat : windowGlassMat
              );
              glassMesh.position.set(0, op.height / 2, 0);
              glassMesh.userData = { type: 'arch_window', id: op.id };
              winGroup.add(glassMesh);

              wallGroup.add(winGroup);
            }

            currentU = opEndU;
          }

          if (currentU < wallLen - 0.01) {
            const segLen = wallLen - currentU;
            const geom = new THREE.BoxGeometry(segLen, wallH, wallThick);
            const mesh = new THREE.Mesh(geom, baseMat);
            mesh.position.set(currentU + segLen / 2, wallH / 2, 0);
            mesh.userData = { type: 'arch_wall', id: wall.id };
            wallGroup.add(mesh);

            const edges = new THREE.EdgesGeometry(geom);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: isWallSelected ? 0xfde047 : 0x475569 })
            );
            line.position.copy(mesh.position);
            wallGroup.add(line);
          }
        }

        this.group.add(wallGroup);
      }
    }

    // 2. Build 3D Parametric RCC Staircases Across All Building Storeys & Diaphragms
    if (visibility.showStaircases) {
      let stairsToRender = stairList;
      if (stairsToRender.length === 0) {
        // Auto-provide standard building staircase at core location so it renders immediately
        stairsToRender = [
          StaircasePlacementEngine.createDefaultStaircase('floor_0', { x: 4.5, y: -8.95 }),
        ];
      }

      const storeys: DiaphragmLevelInfo[] =
        visibility.diaphragmLevels && visibility.diaphragmLevels.length > 0
          ? visibility.diaphragmLevels
          : [
              {
                levelIndex: 1,
                levelName: 'Ground to 1st Floor Diaphragm',
                bottomElevationY: 0.0,
                topElevationY: 3.2,
                storeyHeightM: 3.2,
                midLandingElevationY: 1.6,
                isRoofLevel: false,
              },
              {
                levelIndex: 2,
                levelName: '1st to 2nd Floor Diaphragm',
                bottomElevationY: 3.2,
                topElevationY: 6.4,
                storeyHeightM: 3.2,
                midLandingElevationY: 4.8,
                isRoofLevel: false,
              },
              {
                levelIndex: 3,
                levelName: '2nd to 3rd Floor Diaphragm',
                bottomElevationY: 6.4,
                topElevationY: 9.6,
                storeyHeightM: 3.2,
                midLandingElevationY: 8.0,
                isRoofLevel: false,
              },
              {
                levelIndex: 4,
                levelName: '3rd to 4th Floor Diaphragm',
                bottomElevationY: 9.6,
                topElevationY: 12.8,
                storeyHeightM: 3.2,
                midLandingElevationY: 11.2,
                isRoofLevel: false,
              },
              {
                levelIndex: 5,
                levelName: '4th Floor to Roof Diaphragm',
                bottomElevationY: 12.8,
                topElevationY: 15.65,
                storeyHeightM: 2.85,
                midLandingElevationY: 14.23,
                isRoofLevel: true,
              },
            ];

      for (const stair of stairsToRender) {
        const isStairSelected = selectedId === stair.id;
        const L = stair.roomLength || 4.8;
        const B = stair.roomWidth || 2.4;
        const Wf = stair.flightWidth || 1.1;
        const DL = stair.landingDepth || 1.2;
        const tw = (stair.waistThicknessMm || 160) / 1000;
        const treadM = (stair.treadMm || 275) / 1000;
        const numTreads = stair.treadCount || 9;
        const numRisers = stair.riserCount || 10;
        const rotRad = -((stair.rotation || 0) * Math.PI) / 180;

        // Render staircase continuously storey by storey across ALL floors
        for (let sIdx = 0; sIdx < storeys.length; sIdx++) {
          const storey = storeys[sIdx];
          const stairGroup = new THREE.Group();
          const baseElevation = storey.bottomElevationY;
          stairGroup.position.set(stair.position.x, baseElevation, stair.position.y);
          stairGroup.rotation.y = rotRad;

          const storeyH = storey.storeyHeightM || 3.2;
          const H1 = storeyH / 2; // Mid-landing height
          const H2 = storeyH - H1; // Flight 2 height
          const riserM = H1 / numRisers; // Exact riser height for this storey

          // A. 3D Floor Landing Slab (Y = 0)
          const floorLandingGeom = new THREE.BoxGeometry(B, tw, DL);
          const floorLandingMesh = new THREE.Mesh(floorLandingGeom, stairLandingMat);
          floorLandingMesh.position.set(B / 2, -tw / 2, DL / 2);
          floorLandingMesh.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
          stairGroup.add(floorLandingMesh);

          // B. 3D Mid-Landing Slab (Y = H1)
          const midLandingGeom = new THREE.BoxGeometry(B, tw, DL);
          const midLandingMesh = new THREE.Mesh(midLandingGeom, stairMidLandingMat);
          midLandingMesh.position.set(B / 2, H1 - tw / 2, L - DL / 2);
          midLandingMesh.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
          stairGroup.add(midLandingMesh);

          // C. 3D Flight 1 (Stepped RCC Solid rising 0 -> H1)
          for (let i = 0; i < numTreads; i++) {
            const stepH = (i + 1) * riserM;
            const stepGeom = new THREE.BoxGeometry(Wf, stepH, treadM);
            const stepMesh = new THREE.Mesh(
              stepGeom,
              isStairSelected ? selectedWallMat : stairConcreteMat
            );
            stepMesh.position.set(Wf / 2, stepH / 2, DL + i * treadM + treadM / 2);
            stepMesh.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
            stairGroup.add(stepMesh);
          }

          // Flight 1 Handrail
          const f1RailGeom = new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(numTreads * treadM, H1));
          const f1RailMesh = new THREE.Mesh(f1RailGeom, stairRailingMat);
          const f1Angle = Math.atan2(H1, numTreads * treadM);
          f1RailMesh.rotation.x = Math.PI / 2 - f1Angle;
          f1RailMesh.position.set(
            Wf - 0.05,
            H1 / 2 + 0.9,
            DL + (numTreads * treadM) / 2
          );
          stairGroup.add(f1RailMesh);

          // D. 3D Flight 2 (Stepped RCC Solid rising H1 -> H1+H2 returning back towards DL)
          for (let i = 0; i < numTreads; i++) {
            const stepH = (i + 1) * riserM;
            const stepGeom = new THREE.BoxGeometry(Wf, stepH, treadM);
            const stepMesh = new THREE.Mesh(
              stepGeom,
              isStairSelected ? selectedWallMat : stairConcreteMat
            );
            stepMesh.position.set(
              B - Wf / 2,
              H1 + stepH / 2,
              L - DL - (i * treadM + treadM / 2)
            );
            stepMesh.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
            stairGroup.add(stepMesh);
          }

          // Flight 2 Handrail
          const f2RailGeom = new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(numTreads * treadM, H2));
          const f2RailMesh = new THREE.Mesh(f2RailGeom, stairRailingMat);
          f2RailMesh.rotation.x = -(Math.PI / 2 - f1Angle);
          f2RailMesh.position.set(
            B - Wf + 0.05,
            H1 + H2 / 2 + 0.9,
            DL + (numTreads * treadM) / 2
          );
          stairGroup.add(f2RailMesh);

          // E. 3D Enclosure Walls with Dual Landing Doors
          if (stair.hasEnclosureWalls) {
            const wallThick = (stair.wallThicknessMm || 230) / 1000;
            const wallH = storeyH;

            // Back Wall (at Mid-Landing Z = L)
            const backWallGeom = new THREE.BoxGeometry(B + wallThick * 2, wallH, wallThick);
            const backWall = new THREE.Mesh(backWallGeom, stairEnclosureWallMat);
            backWall.position.set(B / 2, wallH / 2, L + wallThick / 2);
            stairGroup.add(backWall);

            // Left Wall (at X = 0) with Mid-Landing Left Door Cutout
            if (stair.hasLeftDoor) {
              const doorW = stair.leftDoorWidth || 1.0;
              const doorH = 2.1;
              const seg1Len = L - DL;
              const seg1Geom = new THREE.BoxGeometry(wallThick, wallH, seg1Len);
              const seg1 = new THREE.Mesh(seg1Geom, stairEnclosureWallMat);
              seg1.position.set(-wallThick / 2, wallH / 2, seg1Len / 2);
              stairGroup.add(seg1);

              if (wallH > H1 + doorH) {
                const lintelH = wallH - (H1 + doorH);
                const lintelGeom = new THREE.BoxGeometry(wallThick, lintelH, DL);
                const lintel = new THREE.Mesh(lintelGeom, stairEnclosureWallMat);
                lintel.position.set(-wallThick / 2, H1 + doorH + lintelH / 2, L - DL / 2);
                stairGroup.add(lintel);
              }
            } else {
              const leftWallGeom = new THREE.BoxGeometry(wallThick, wallH, L);
              const leftWall = new THREE.Mesh(leftWallGeom, stairEnclosureWallMat);
              leftWall.position.set(-wallThick / 2, wallH / 2, L / 2);
              stairGroup.add(leftWall);
            }

            // Right Wall (at X = B) with Mid-Landing Right Door Cutout
            if (stair.hasRightDoor) {
              const doorW = stair.rightDoorWidth || 1.0;
              const doorH = 2.1;
              const seg1Len = L - DL;
              const seg1Geom = new THREE.BoxGeometry(wallThick, wallH, seg1Len);
              const seg1 = new THREE.Mesh(seg1Geom, stairEnclosureWallMat);
              seg1.position.set(B + wallThick / 2, wallH / 2, seg1Len / 2);
              stairGroup.add(seg1);

              if (wallH > H1 + doorH) {
                const lintelH = wallH - (H1 + doorH);
                const lintelGeom = new THREE.BoxGeometry(wallThick, lintelH, DL);
                const lintel = new THREE.Mesh(lintelGeom, stairEnclosureWallMat);
                lintel.position.set(B + wallThick / 2, H1 + doorH + lintelH / 2, L - DL / 2);
                stairGroup.add(lintel);
              }
            } else {
              const rightWallGeom = new THREE.BoxGeometry(wallThick, wallH, L);
              const rightWall = new THREE.Mesh(rightWallGeom, stairEnclosureWallMat);
              rightWall.position.set(B + wallThick / 2, wallH / 2, L / 2);
              stairGroup.add(rightWall);
            }
          }

          // F. 3D Floating Staircase Tag Badge
          const stairBadge = createTextBadge(
            `${stair.name || 'RCC STAIR'} [Storey ${storey.levelIndex}]`,
            `EL. +${storey.bottomElevationY.toFixed(2)}m → +${storey.topElevationY.toFixed(2)}m`,
            isStairSelected ? '#78350f' : '#1e1b4b',
            isStairSelected ? '#f59e0b' : '#6366f1'
          );
          stairBadge.position.set(B / 2, H1 + 1.2, L / 2);
          stairBadge.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
          stairGroup.add(stairBadge);

          // G. If top / roof storey, cap with roof landing slab
          if (sIdx === storeys.length - 1) {
            const roofLandingGeom = new THREE.BoxGeometry(B, tw, DL);
            const roofLandingMesh = new THREE.Mesh(roofLandingGeom, stairLandingMat);
            roofLandingMesh.position.set(B / 2, storeyH - tw / 2, DL / 2);
            roofLandingMesh.userData = { type: 'arch_staircase', id: stair.id, storey: storey.levelIndex };
            stairGroup.add(roofLandingMesh);
          }

          this.group.add(stairGroup);
        }
      }
    }

    // 3. 3D Room Floor Footprints & 3D Badges
    if (visibility.showRoomLabels) {
      for (const room of roomList) {
        if (room.boundary.length >= 3) {
          const centroid = room.labelPosition || ArchitecturalGeometryEngine.polygonCentroid(room.boundary);
          const isSelected = selectedId === room.id;

          const sprite = createTextBadge(
            room.name,
            `${room.area.toFixed(1)} m²`,
            isSelected ? '#92400e' : '#1e293b',
            isSelected ? '#f59e0b' : '#0284c7'
          );

          const floorIdx = parseInt(room.floorId.replace('floor_', ''), 10) || 0;
          const roomElev = floorIdx * 3.2;

          sprite.position.set(centroid.x, roomElev + 0.35, centroid.y);
          sprite.userData = { type: 'arch_room', id: room.id };
          this.group.add(sprite);
        }
      }
    }
  }

  public dispose() {
    disposeHierarchy(this.group);
    this.group.clear();
  }
}
