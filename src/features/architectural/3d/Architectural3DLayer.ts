/**
 * High-Performance Three.js 3D Layer for Architectural BIM Elements
 * Real-time 3D Walls, Segmented Openings, 3D Doors & Windows with Material Disposal
 */

import * as THREE from 'three';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from '../engines/architecturalGeometryEngine';

function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m: any) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  });
}

function createTextBadge(
  title: string,
  subtitle?: string,
  bgColor = '#1e293b',
  borderColor = '#64748b'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 70;
  const ctx = canvas.getContext('2d');

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

export interface Architectural3DVisibility {
  showWalls: boolean;
  showDoors: boolean;
  showWindows: boolean;
  showOpenings: boolean;
  showRoomLabels: boolean;
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
    selectedId: string | null,
    visibility: Architectural3DVisibility = {
      showWalls: true,
      showDoors: true,
      showWindows: true,
      showOpenings: true,
      showRoomLabels: true,
    }
  ) {
    // Clear & dispose previous objects
    disposeHierarchy(this.group);
    this.group.clear();

    const wallList = Object.values(walls);
    const doorList = Object.values(doors);
    const windowList = Object.values(windows);
    const openingList = Object.values(openings);
    const roomList = Object.values(rooms);

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
      color: 0x78350f, // Warm wood / timber
      roughness: 0.4,
    });
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.45,
    });
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Dark aluminum frame
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

    if (visibility.showWalls) {
      // Build 3D Walls with clean segmented openings
      for (const wall of wallList) {
        const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
        if (wallLen < 0.05) continue;

        const isWallSelected = selectedId === wall.id;
        const baseMat = isWallSelected
          ? selectedWallMat
          : wall.wallType === 'INTERNAL'
          ? internalWallMat
          : externalWallMat;

        // Collect hosted openings for this wall
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

        // Sort hosted openings along wall length
        hostedList.sort((a, b) => a.pos - b.pos);

        // Compute wall orientation
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y; // World Z
        const dir = new THREE.Vector3(dx, 0, dy).normalize();
        const wallNormal = new THREE.Vector3(-dir.z, 0, dir.x);
        const wallElevation = wall.baseElevation;
        const wallH = wall.height;
        const wallThick = wall.thickness;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(wall.start.x, wallElevation, wall.start.y);

        // Rotate wallGroup so X-axis aligns with wall direction
        const angle = Math.atan2(dy, dx);
        wallGroup.rotation.y = -angle;

        if (hostedList.length === 0) {
          // Solid Wall without openings
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
              linewidth: 1,
            })
          );
          line.position.copy(mesh.position);
          wallGroup.add(line);
        } else {
          // Segmented Wall with exact cutouts
          let currentU = 0;

          for (const op of hostedList) {
            const opStartU = Math.max(0, op.pos - op.width / 2);
            const opEndU = Math.min(wallLen, op.pos + op.width / 2);

            // 1. Solid Segment before opening
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

            // 2. Parapet / Wall section below opening (for Windows)
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

            // 3. Wall section (Transom / Lintel) above opening
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

            // 4. Render 3D Door Geometry inside opening
            if (op.type === 'DOOR') {
              const isDoorSelected = selectedId === op.id;
              const doorGroup = new THREE.Group();
              doorGroup.position.set(opStartU + opActualW / 2, op.sill, 0);

              // Timber Door Frame
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

              // 3D Door Leaf
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

            // 5. Render 3D Window Geometry inside opening
            if (op.type === 'WINDOW') {
              const isWinSelected = selectedId === op.id;
              const winGroup = new THREE.Group();
              winGroup.position.set(opStartU + opActualW / 2, op.sill, 0);

              // Aluminum Window Frame
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

              // Glass Pane
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

          // Final Solid Segment after last opening
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

    // 6. 3D Room Floor Footprints & 3D Badges
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

          // Get elevation of the room from floorId or default
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
