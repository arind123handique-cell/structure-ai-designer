// @ts-nocheck
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useProjectStore } from '@/features/projects/projectStore';
import { Member3D, Node3D } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { GradeBeamDesignEngine } from '@/features/design/gradebeam/gradeBeamEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { PileDesignEngine } from '@/features/design/pile/pileDesignEngine';
import { CombinedPileCapEngine, CombinedPileCapGroup } from '@/features/design/pilecap/combinedPileCapEngine';
import {
  RotateCcw,
  Eye,
  Maximize2,
  Box,
  Layers,
  Sparkles,
  Tag,
  Compass,
  Link2,
  Unlink,
  CheckSquare,
  MousePointer,
  Zap,
} from 'lucide-react';

/**
 * Traverses and deeply disposes Three.js geometries, materials, and textures
 * to prevent GPU/RAM memory leaks.
 */
function disposeThreeObject(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
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

/**
 * Creates lightweight, high-visibility 2D canvas texture sprite for 3D viewport labels.
 */
function createTextBadgeSprite(
  primaryText: string,
  secondaryText: string | null = null,
  bgColor: string = '#047857',
  borderColor: string = '#10b981',
  textColor: string = '#ffffff'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const radius = 16;
    const x = 8;
    const y = 8;
    const w = canvas.width - 16;
    const h = canvas.height - 16;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (secondaryText) {
      ctx.fillText(primaryText, canvas.width / 2, 34);
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(secondaryText, canvas.width / 2, 58);
    } else {
      ctx.fillText(primaryText, canvas.width / 2, canvas.height / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.8, 0.9, 1.0);
  return sprite;
}

export const Structural3DViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialCameraFramedRef = useRef(false);

  // Dynamic mesh tracking
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const memberMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const plateMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const pileCapMeshesRef = useRef<THREE.Group[]>([]);
  const supportConeMeshesRef = useRef<THREE.Mesh[]>([]);
  const gradeBeamMeshesRef = useRef<THREE.Group[]>([]);

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const {
    activeModel,
    selectedMemberId,
    selectMember,
    selectedPlateId,
    selectPlate,
    filterLayers,
    toggleFilterLayer,
    projectPileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    selectedSupportNodeIds,
    selectSupportNode,
    clearSelectedSupportNodes,
    mergeSelectedPileCaps,
    unmergePileCapGroup,
  } = useProjectStore() as any;

  const [showLabels, setShowLabels] = useState(true);
  const [showWallLabels, setShowWallLabels] = useState(true);
  const [showPileCaps, setShowPileCaps] = useState(true);
  const [showGradeBeams, setShowGradeBeams] = useState(true);
  const [showSlabs, setShowSlabs] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [selectedGradeBeamId, setSelectedGradeBeamId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  // Column and Support Numbering Mapping
  const columnSupportMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(activeModel);
  }, [activeModel]);

  const columnMemberMapping = useMemo(() => {
    return ColumnNumberingService.getColumnMemberMapping(activeModel);
  }, [activeModel]);

  // Grade Tie Beams
  const gradeBeamsList = useMemo(() => {
    if (!activeModel) return [];
    return GradeBeamDesignEngine.discoverAndDesignAll(activeModel);
  }, [activeModel]);

  // Compute Combined & Shear Wall Pile Caps
  const combinedPileCaps: CombinedPileCapGroup[] = useMemo(() => {
    if (!activeModel) return [];
    const availablePiles = projectPileTypes && projectPileTypes.length > 0
      ? projectPileTypes
      : PileDesignEngine.getDefaultProjectPileTypes();
    const defaultPile = availablePiles[0];

    const indMap = new Map<number, any>();
    activeModel.supports.forEach((sup) => {
      const assignedTypeId = supportPileAssignments[sup.nodeId] || defaultPile.id;
      const assignedPile = availablePiles.find((p) => p.id === assignedTypeId) || defaultPile;
      const overrides = customPileCapOverrides[sup.nodeId];
      const reactions = activeModel.reactions?.filter((r) => r.nodeId === sup.nodeId) || [];
      const maxFy = reactions.length > 0 ? Math.max(...reactions.map((r) => Math.abs(r.fy))) : 650;
      const capResult = PileCapDesignEngine.design({
        supportNodeId: sup.nodeId,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: assignedPile.diameter,
        safePileCapacity: assignedPile.safeWorkingLoad,
        customPileCount: overrides?.customPileCount,
        customCapLength: overrides?.customCapLength,
        customCapWidth: overrides?.customCapWidth,
        customCapDepth: overrides?.customCapDepth,
        assignedPileTypeId: assignedPile.id,
        factoredVerticalLoad: maxFy,
        fck: 25,
        fy: 500,
        governingLoadCase: 5,
      });
      indMap.set(sup.nodeId, capResult);
    });

    return CombinedPileCapEngine.detectAndDesignAll(
      activeModel,
      indMap,
      defaultPile.diameter || 350,
      manualMergedPileCapGroups,
      detachedCombinedCapNodeIds
    );
  }, [activeModel, projectPileTypes, supportPileAssignments, customPileCapOverrides, manualMergedPileCapGroups, detachedCombinedCapNodeIds]);

  const absorbedNodeMap = useMemo(() => {
    const map = new Map<number, CombinedPileCapGroup>();
    combinedPileCaps.forEach((grp) => {
      grp.absorbedIndividualCaps.forEach((id) => map.set(id, grp));
    });
    return map;
  }, [combinedPileCaps]);

  // Helper to frame camera on model
  const frameCameraToModel = (model: typeof activeModel) => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (model && model.nodes && model.nodes.size > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      model.nodes.forEach((n) => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
        if (n.z < minZ) minZ = n.z;
        if (n.z > maxZ) maxZ = n.z;
      });

      if (minX !== Infinity) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;
        const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 12);
        cameraRef.current.position.set(cx + maxDim * 1.25, cy + maxDim * 0.85, cz + maxDim * 1.35);
        controlsRef.current.target.set(cx, cy, cz);
        controlsRef.current.update();
        return;
      }
    }
    cameraRef.current.position.set(30, 25, 40);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Setup Three.js Scene ONCE on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0F172A'); // Deep Navy Canvas
    sceneRef.current = scene;

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    dynamicGroupRef.current = dynamicGroup;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(30, 25, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'lowp',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    rendererRef.current = renderer;

    containerRef.current.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 1500;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(50, 80, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-50, -30, -50);
    scene.add(dirLight2);

    // Static Ground Grid
    const gridHelper = new THREE.GridHelper(80, 40, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // ResizeObserver for reliable dimension tracking across tabs & window resizes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Continuous RAF Render Loop
    let isMounted = true;
    let animationFrameId: number;

    const animate = () => {
      if (!isMounted) return;
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
        controlsRef.current.update();
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposeThreeObject(scene);
      renderer.dispose();
    };
  }, []);

  // Update Dynamic Scene Meshes
  useEffect(() => {
    const dynamicGroup = dynamicGroupRef.current;
    if (!dynamicGroup || !activeModel) return;

    // Frame camera on first model load
    if (!initialCameraFramedRef.current) {
      frameCameraToModel(activeModel);
      initialCameraFramedRef.current = true;
    }

    // Deeply dispose previous dynamic meshes & textures
    disposeThreeObject(dynamicGroup);
    dynamicGroup.clear();

    memberMeshesRef.current.clear();
    plateMeshesRef.current.clear();
    pileCapMeshesRef.current = [];
    supportConeMeshesRef.current = [];
    gradeBeamMeshesRef.current = [];

    const { nodes, members, plates, supports } = activeModel;

    // Shared Low-Poly Geometries & Materials
    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1 });
    const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.1 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5, roughness: 0.2 });
    const slabPlateMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.5,
    });
    const wallPlateMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const selectedPlateMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const supportMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.7 });
    const selectedSupportMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6, roughness: 0.2 });
    const pileCapMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.1 });
    const selectedPileCapMaterial = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0xb45309, emissiveIntensity: 0.4, roughness: 0.3 });
    const pileMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.25 });

    // 1. Draw Members (6 radial segments for lightweight RAM)
    members.forEach((member) => {
      const isCol = member.classification === 'COLUMN';
      if (isCol && !filterLayers.showColumns) return;
      if (!isCol && !filterLayers.showBeams) return;

      const n1 = nodes.get(member.startNodeId);
      const n2 = nodes.get(member.endNodeId);
      if (!n1 || !n2) return;

      const p1 = new THREE.Vector3(n1.x, n1.y, n1.z);
      const p2 = new THREE.Vector3(n2.x, n2.y, n2.z);
      const distance = p1.distanceTo(p2);
      if (distance <= 0.001) return;

      const radius = isCol ? 0.24 : 0.15;
      const geometry = new THREE.CylinderGeometry(radius, radius, distance, 5);
      const isSelected = selectedMemberId === member.id;
      const material = isSelected ? selectedMaterial : isCol ? columnMaterial : beamMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      mesh.userData = { memberId: member.id, type: 'member' };
      dynamicGroup.add(mesh);
      memberMeshesRef.current.set(member.id, mesh);

      if (isCol && showLabels) {
        const isGroundCol = supports.has(member.startNodeId) || supports.has(member.endNodeId);
        if (isGroundCol) {
          const colInfo = columnMemberMapping.get(member.id);
          const colLabel = colInfo?.columnLabel || `C${member.id}`;
          const sprite = createTextBadgeSprite(colLabel, `Mem #${member.id}`, '#064e3b', '#10b981', '#ffffff');
          sprite.position.copy(midpoint);
          sprite.position.y += 0.3;
          dynamicGroup.add(sprite);
        }
      }
    });

    // 2. Draw Plates — strictly differentiated: horizontal SLABS vs vertical SHEAR WALLS (Lift Core)
    if (filterLayers.showPlates) {
      plates.forEach((plate) => {
        const isWallPlate = plate.classification === 'WALL';
        if (isWallPlate && !showWalls) return;
        if (!isWallPlate && !showSlabs) return;
        if (plate.nodeIds.length >= 3) {
          const pNodes = plate.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as Node3D[];
          if (pNodes.length >= 3) {
            const geom = new THREE.BufferGeometry();
            const vertices: number[] = [];

            if (pNodes.length === 4) {
              vertices.push(
                pNodes[0].x, pNodes[0].y, pNodes[0].z,
                pNodes[1].x, pNodes[1].y, pNodes[1].z,
                pNodes[2].x, pNodes[2].y, pNodes[2].z,
                pNodes[0].x, pNodes[0].y, pNodes[0].z,
                pNodes[2].x, pNodes[2].y, pNodes[2].z,
                pNodes[3].x, pNodes[3].y, pNodes[3].z
              );
            } else if (pNodes.length === 3) {
              vertices.push(
                pNodes[0].x, pNodes[0].y, pNodes[0].z,
                pNodes[1].x, pNodes[1].y, pNodes[1].z,
                pNodes[2].x, pNodes[2].y, pNodes[2].z
              );
            }

            geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geom.computeVertexNormals();

            const baseMat = isWallPlate ? wallPlateMaterial : slabPlateMaterial;
            const isSelectedPlate = selectedPlateId === plate.id;
            const mat = isSelectedPlate ? selectedPlateMaterial : baseMat;
            const plateMesh = new THREE.Mesh(geom, mat);
            plateMesh.userData = { type: 'plate', plateId: plate.id, isWall: isWallPlate };
            plateMeshesRef.current.set(plate.id, plateMesh);
            dynamicGroup.add(plateMesh);
          }
        }
      });
    }

    // 2b. Shear Wall Labels — only on vertical Lift Core shear wall plates; respects Walls toggle
    if (showWallLabels && showWalls && filterLayers.showPlates) {
      let wallLabelCount = 0;
      const wallPlates = Array.from(plates.values()).filter((p: any) => p.classification === 'WALL');
      wallPlates.forEach((plate: any) => {
        if (wallLabelCount >= 32) return;
        const pNodes = plate.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as Node3D[];
        if (pNodes.length < 3) return;
        const cx = pNodes.reduce((s: number, n: Node3D) => s + n.x, 0) / pNodes.length;
        const cy = pNodes.reduce((s: number, n: Node3D) => s + n.y, 0) / pNodes.length;
        const cz = pNodes.reduce((s: number, n: Node3D) => s + n.z, 0) / pNodes.length;
        const isSelected = selectedPlateId === plate.id;
        const bg = isSelected ? '#7c3aed' : '#5b21b6';
        const border = isSelected ? '#a78bfa' : '#7c3aed';
        const sprite = createTextBadgeSprite(
          `SW-${plate.id}`,
          isSelected ? 'SELECTED' : `${Math.round((plate.thickness || 0.23) * 1000)}mm`,
          bg,
          border,
          '#ffffff'
        );
        sprite.position.set(cx, cy + 0.8, cz);
        dynamicGroup.add(sprite);
        wallLabelCount++;
      });
    }

    // 3. Draw Supports and Individual / Combined Pile Caps
    if (filterLayers.showSupports) {
      const availablePileTypes = projectPileTypes && projectPileTypes.length > 0
        ? projectPileTypes
        : PileDesignEngine.getDefaultProjectPileTypes();
      const defaultPile = availablePileTypes[0];

      // A. Individual Supports & Single Pile Caps
      supports.forEach((supp) => {
        const node = nodes.get(supp.nodeId);
        if (!node) return;

        const supInfo = columnSupportMapping.get(supp.nodeId);
        const colLabel = supInfo?.columnLabel || `C${supp.nodeId}`;
        const pileCapLabel = supInfo?.pileCapLabel || `PC-${supp.nodeId}`;
        const isSelected = selectedSupportNodeIds.includes(supp.nodeId);
        const isAbsorbed = absorbedNodeMap.has(supp.nodeId);

        // Support Joint Pyramid (4-sided cone)
        const coneGeom = new THREE.ConeGeometry(0.35, 0.6, 4);
        const coneMesh = new THREE.Mesh(coneGeom, isSelected ? selectedSupportMaterial : supportMaterial);
        coneMesh.position.set(node.x, node.y - 0.3, node.z);
        coneMesh.userData = { type: 'support', nodeId: supp.nodeId };
        dynamicGroup.add(coneMesh);
        supportConeMeshesRef.current.push(coneMesh);

        // If NOT absorbed in a combined cap, draw individual pile cap
        if (showPileCaps && !isAbsorbed) {
          const capGroup = new THREE.Group();

          const reactions = activeModel.reactions?.filter((r) => r.nodeId === supp.nodeId) || [];
          let maxFy = reactions.length > 0 ? Math.max(...reactions.map((r) => Math.abs(r.fy))) : 650;
          if (maxFy <= 0) maxFy = 650;

          const assignedTypeId = supportPileAssignments[supp.nodeId] || defaultPile.id;
          const assignedPile = availablePileTypes.find((p) => p.id === assignedTypeId) || defaultPile;
          const overrides = customPileCapOverrides[supp.nodeId];

          const capResult = PileCapDesignEngine.design({
            supportNodeId: supp.nodeId,
            colWidth: 450,
            colDepth: 550,
            pileDiameter: assignedPile.diameter,
            safePileCapacity: assignedPile.safeWorkingLoad,
            customPileCount: overrides?.customPileCount,
            customCapLength: overrides?.customCapLength,
            customCapWidth: overrides?.customCapWidth,
            customCapDepth: overrides?.customCapDepth,
            assignedPileTypeId: assignedPile.id,
            factoredVerticalLoad: maxFy,
            fck: 25,
            fy: 500,
            governingLoadCase: 5,
          });

          const capWidth = capResult.capWidth / 1000;
          const capLength = capResult.capLength / 1000;
          const capDepth = capResult.capDepth / 1000;
          const pileRadius = (capResult.pileDiameter / 1000) / 2;
          const pileLength = 4.5;

          let pileOffsets: { x: number; z: number }[] = [];
          if (capResult.pileOffsets && capResult.pileOffsets.length > 0) {
            pileOffsets = capResult.pileOffsets.map((p) => ({ x: p.x / 1000, z: -p.y / 1000 }));
          } else {
            const s_m = (3 * capResult.pileDiameter) / 1000;
            pileOffsets = [
              { x: -s_m / 2, z: -s_m / 2 },
              { x: s_m / 2, z: -s_m / 2 },
              { x: -s_m / 2, z: s_m / 2 },
              { x: s_m / 2, z: s_m / 2 },
            ];
          }

          let capGeom: THREE.BufferGeometry;
          if (capResult.pileCount === 5) {
            const Rp = (capResult.pileSpacing / 1000) / (2 * Math.sin(Math.PI / 5));
            const overhangM = (capResult.edgeDistance || 300) / 1000;
            const R = Rp + overhangM;
            const shape = new THREE.Shape();
            for (let i = 0; i < 5; i++) {
              const angle = Math.PI / 2 + (2 * Math.PI * i) / 5;
              const px = R * Math.cos(angle);
              const py = R * Math.sin(angle);
              if (i === 0) shape.moveTo(px, py);
              else shape.lineTo(px, py);
            }
            shape.closePath();
            capGeom = new THREE.ExtrudeGeometry(shape, { depth: capDepth, bevelEnabled: false });
            capGeom.rotateX(-Math.PI / 2);
            capGeom.translate(0, -capDepth, 0);
          } else {
            capGeom = new THREE.BoxGeometry(capWidth, capDepth, capLength);
            capGeom.translate(0, -capDepth / 2, 0);
          }

          const capMesh = new THREE.Mesh(capGeom, isSelected ? selectedPileCapMaterial : pileCapMaterial);
          capMesh.userData = { type: 'support', nodeId: supp.nodeId };
          capGroup.add(capMesh);

          const capEdges = new THREE.EdgesGeometry(capGeom);
          const capLine = new THREE.LineSegments(
            capEdges,
            new THREE.LineBasicMaterial({ color: isSelected ? 0xfef08a : 0x94a3b8, linewidth: 1 })
          );
          capGroup.add(capLine);

          // 6-segment cylinders for low memory (reduced from 8)
          const pileShaftGeom = new THREE.CylinderGeometry(pileRadius, pileRadius, pileLength, 6);
          const pileToeGeom = new THREE.ConeGeometry(pileRadius, 0.35, 6);

          pileOffsets.forEach((off) => {
            const shaftMesh = new THREE.Mesh(pileShaftGeom, pileMat);
            shaftMesh.position.set(off.x, -capDepth - pileLength / 2, off.z);
            capGroup.add(shaftMesh);

            const toeMesh = new THREE.Mesh(pileToeGeom, pileMat);
            toeMesh.rotation.x = Math.PI;
            toeMesh.position.set(off.x, -capDepth - pileLength - 0.18, off.z);
            capGroup.add(toeMesh);
          });

          capGroup.position.set(node.x, node.y, node.z);
          dynamicGroup.add(capGroup);
          pileCapMeshesRef.current.push(capGroup);
        }

        if (showLabels) {
          const sprite = createTextBadgeSprite(
            colLabel,
            pileCapLabel,
            isSelected ? '#b45309' : '#047857',
            isSelected ? '#f59e0b' : '#34d399',
            '#ffffff'
          );
          sprite.position.set(node.x, node.y + 0.4, node.z);
          dynamicGroup.add(sprite);
        }
      });

      // B. Combined & Shear Wall 3D Monolithic Pile Caps
      if (showPileCaps && combinedPileCaps.length > 0) {
        combinedPileCaps.forEach((grp) => {
          const isShearWall = grp.reason === 'SHEAR_WALL';
          const isSelected = grp.nodeIds.some((nid) => selectedSupportNodeIds.includes(nid));

          const cx = (grp.minX + grp.maxX) / 2;
          const cz = (grp.minZ + grp.maxZ) / 2;
          const capL = grp.capLength / 1000;
          const capB = grp.capWidth / 1000;
          const capD = grp.capDepth / 1000;
          const pileRadius = (grp.pileDiameter / 1000) / 2;
          const pileLength = 5.0;

          const combGroup = new THREE.Group();

          const combMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0xd97706 : isShearWall ? 0x991b1b : 0x065f46,
            roughness: 0.35,
            metalness: 0.2,
          });

          const boxGeom = new THREE.BoxGeometry(capL, capD, capB);
          boxGeom.translate(0, -capD / 2, 0);

          const combMesh = new THREE.Mesh(boxGeom, combMat);
          combMesh.userData = { type: 'combinedPileCap', groupId: grp.groupId, nodeIds: grp.nodeIds };
          combGroup.add(combMesh);

          const edges = new THREE.EdgesGeometry(boxGeom);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
              color: isSelected ? 0xfde047 : isShearWall ? 0xf87171 : 0x34d399,
              linewidth: 1.5,
            })
          );
          combGroup.add(line);

          const pileShaftGeom = new THREE.CylinderGeometry(pileRadius, pileRadius, pileLength, 6);
          const pileToeGeom = new THREE.ConeGeometry(pileRadius, 0.35, 6);

          grp.pileOffsets.forEach((off) => {
            const px = off.x / 1000;
            const pz = -off.z / 1000;

            const shaftMesh = new THREE.Mesh(pileShaftGeom, pileMat);
            shaftMesh.position.set(px, -capD - pileLength / 2, pz);
            combGroup.add(shaftMesh);

            const toeMesh = new THREE.Mesh(pileToeGeom, pileMat);
            toeMesh.rotation.x = Math.PI;
            toeMesh.position.set(px, -capD - pileLength - 0.18, pz);
            combGroup.add(toeMesh);
          });

          combGroup.position.set(cx, 0, cz);
          dynamicGroup.add(combGroup);
          pileCapMeshesRef.current.push(combGroup);

          if (showLabels) {
            const badge = createTextBadgeSprite(
              grp.label.split(' (')[0],
              `${grp.pileCount}P COMBINED`,
              isShearWall ? '#881337' : '#064e3b',
              isShearWall ? '#f43f5e' : '#10b981',
              '#ffffff'
            );
            badge.position.set(cx, 0.6, cz);
            dynamicGroup.add(badge);
          }
        });
      }
    }

    // 4. Draw Grade Tie Beams
    if (showGradeBeams && gradeBeamsList.length > 0) {
      const normalGradeBeamMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.35, metalness: 0.2 });
      const selectedGradeBeamMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.4, roughness: 0.25 });

      gradeBeamsList.forEach((gb) => {
        const n1 = nodes.get(gb.startNodeId);
        const n2 = nodes.get(gb.endNodeId);
        if (!n1 || !n2) return;

        const p1 = new THREE.Vector3(n1.x, n1.y, n1.z);
        const p2 = new THREE.Vector3(n2.x, n2.y, n2.z);
        const distance = p1.distanceTo(p2);
        if (distance <= 0.001) return;

        const gbGroup = new THREE.Group();
        const b = gb.b / 1000;
        const D = gb.D / 1000;

        const isSelected = selectedGradeBeamId === gb.gradeBeamId;
        const boxGeom = new THREE.BoxGeometry(b, D, distance);
        const boxMesh = new THREE.Mesh(boxGeom, isSelected ? selectedGradeBeamMat : normalGradeBeamMat);
        boxMesh.position.set(0, -D / 2, 0);
        boxMesh.userData = { gradeBeamId: gb.gradeBeamId, type: 'gradebeam' };
        gbGroup.add(boxMesh);

        const edges = new THREE.EdgesGeometry(boxGeom);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: isSelected ? 0xfde68a : 0x818cf8, linewidth: 1 })
        );
        line.position.copy(boxMesh.position);
        gbGroup.add(line);

        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        gbGroup.position.copy(midpoint);

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const defaultForward = new THREE.Vector3(0, 0, 1);
        gbGroup.quaternion.setFromUnitVectors(defaultForward, dir);

        dynamicGroup.add(gbGroup);
        gradeBeamMeshesRef.current.push(gbGroup);
      });
    }
  }, [
    activeModel,
    selectedMemberId,
    selectedPlateId,
    selectedGradeBeamId,
    selectedSupportNodeIds,
    filterLayers,
    showLabels,
    showWallLabels,
    showSlabs,
    showWalls,
    showPileCaps,
    showGradeBeams,
    columnSupportMapping,
    columnMemberMapping,
    gradeBeamsList,
    combinedPileCaps,
    absorbedNodeMap,
    projectPileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    manualMergedPileCapGroups,
  ]);

  // Click & Hover Raycasting with Multi-Selection Support
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const memberMeshes = Array.from(memberMeshesRef.current.values());
    const plateMeshes = Array.from(plateMeshesRef.current.values());
    const gradeMeshes = gradeBeamMeshesRef.current.flatMap((g) => g.children.filter((c) => (c as any).isMesh));
    const pileCapMeshes = pileCapMeshesRef.current.flatMap((g) => g.children.filter((c) => (c as any).isMesh));
    const supportCones = supportConeMeshesRef.current;
    const allMeshes = [...memberMeshes, ...plateMeshes, ...gradeMeshes, ...pileCapMeshes, ...supportCones];
    const intersects = raycasterRef.current.intersectObjects(allMeshes);

    const isMulti = e.shiftKey || e.ctrlKey || multiSelectMode;

    if (intersects.length > 0) {
      const hit = intersects[0].object;

      if (hit.userData.type === 'gradebeam' && hit.userData.gradeBeamId) {
        setSelectedGradeBeamId(hit.userData.gradeBeamId);
        selectMember(null);
        if (!isMulti) clearSelectedSupportNodes();
      } else if (hit.userData.type === 'combinedPileCap' && hit.userData.nodeIds) {
        const nodeIds: number[] = hit.userData.nodeIds;
        if (isMulti) {
          nodeIds.forEach((nid) => selectSupportNode(nid, true));
        } else {
          clearSelectedSupportNodes();
          nodeIds.forEach((nid) => selectSupportNode(nid, true));
        }
        selectMember(null);
        setSelectedGradeBeamId(null);
      } else if (hit.userData.type === 'support' && hit.userData.nodeId) {
        selectSupportNode(hit.userData.nodeId, isMulti);
        selectMember(null);
        setSelectedGradeBeamId(null);
        (selectPlate as any)(null);
      } else if (hit.userData.type === 'plate' && hit.userData.plateId) {
        (selectPlate as any)(hit.userData.plateId);
        selectMember(null);
        setSelectedGradeBeamId(null);
        if (!isMulti) clearSelectedSupportNodes();
      } else if (hit.userData.memberId) {
        selectMember(hit.userData.memberId);
        setSelectedGradeBeamId(null);
        (selectPlate as any)(null);
        if (!isMulti) {
          clearSelectedSupportNodes();
        }
      }
    } else {
      if (!isMulti) {
        selectMember(null);
        setSelectedGradeBeamId(null);
        (selectPlate as any)(null);
        clearSelectedSupportNodes();
      }
    }
  };

  // Camera Presets
  const setCameraPreset = (preset: 'iso' | 'top' | 'front' | 'side' | 'fit') => {
    if (!controlsRef.current || !cameraRef.current || !activeModel) return;
    const { minX, maxX, minY, maxY, minZ, maxZ } = activeModel.boundingBox;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 10);

    controlsRef.current.target.set(cx, cy, cz);

    switch (preset) {
      case 'iso':
        cameraRef.current.position.set(cx + maxDim * 1.25, cy + maxDim * 0.85, cz + maxDim * 1.35);
        break;
      case 'top':
        cameraRef.current.position.set(cx, cy + maxDim * 2.2, cz + 0.01);
        break;
      case 'front':
        cameraRef.current.position.set(cx, cy, cz + maxDim * 2.0);
        break;
      case 'side':
        cameraRef.current.position.set(cx + maxDim * 2.0, cy, cz);
        break;
      case 'fit':
        frameCameraToModel(activeModel);
        return;
    }
    controlsRef.current.update();
  };

  const selectedColInfo = selectedMemberId ? columnMemberMapping.get(selectedMemberId) : null;
  const selectedMember = selectedMemberId && activeModel ? activeModel.members.get(selectedMemberId) : null;
  const selectedGradeBeam = selectedGradeBeamId ? gradeBeamsList.find((g) => g.gradeBeamId === selectedGradeBeamId) : null;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-surface-dark font-sans min-h-0">
      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full cursor-grab active:cursor-grabbing flex-1 min-h-0"
      />

      {/* Top Toolbar Controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-deep-navy/90 backdrop-blur-md border border-slate-700/60 p-1.5 rounded shadow-lg z-10 font-mono">
        <button
          onClick={() => setCameraPreset('iso')}
          className="px-2.5 py-1 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Isometric View"
        >
          ISO
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className="px-2.5 py-1 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Top View (X-Z Plan)"
        >
          TOP
        </button>
        <button
          onClick={() => setCameraPreset('front')}
          className="px-2.5 py-1 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Front Elevation (X-Y)"
        >
          FRONT
        </button>
        <button
          onClick={() => setCameraPreset('side')}
          className="px-2.5 py-1 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Side Elevation (Z-Y)"
        >
          SIDE
        </button>
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        <button
          onClick={() => setCameraPreset('fit')}
          className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Reset / Fit View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layer Filter & 3D Selection Toggles */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-deep-navy/90 backdrop-blur-md border border-slate-700/60 p-1.5 rounded shadow-lg z-10 flex-wrap font-mono">
        {/* Multi-Select Toggle Button */}
        <button
          onClick={() => setMultiSelectMode(!multiSelectMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            multiSelectMode
              ? 'bg-amber-500/30 text-amber-300 border border-amber-500 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Multi-Select Mode to merge pile caps (or hold Shift)"
        >
          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
          <span>Multi-Select {selectedSupportNodeIds.length > 0 ? `(${selectedSupportNodeIds.length})` : ''}</span>
        </button>

        {/* 3D Label Toggle Button */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showLabels
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Column / Joint Labels (C1, C2, C3, C4...)"
        >
          <Tag className="w-3.5 h-3.5 text-emerald-400" />
          <span>Labels</span>
        </button>

        {/* Shear Wall Labels Toggle — ON/OFF switch per user request */}
        <button
          onClick={() => setShowWallLabels(!showWallLabels)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showWallLabels
              ? 'bg-violet-500/25 text-violet-300 border border-violet-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Shear Wall Labels (SW-89, SW-90, etc) in 3D — ON/OFF"
        >
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span>Wall Labels</span>
        </button>

        {/* Slabs Toggle — horizontal floor & roof diaphragm plates */}
        <button
          onClick={() => setShowSlabs(!showSlabs)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showSlabs ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50 font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Horizontal Floor & Roof Slabs (ON/OFF)"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Slabs</span>
        </button>

        {/* Shear Walls Toggle — vertical lift core shear wall plates */}
        <button
          onClick={() => setShowWalls(!showWalls)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showWalls ? 'bg-violet-500/25 text-violet-300 border border-violet-500/50 font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Vertical Lift Core Shear Walls on Combined Pile Cap (ON/OFF)"
        >
          <Box className="w-3.5 h-3.5 text-violet-400" />
          <span>Shear Walls</span>
        </button>

        {/* 3D Pile Cap & Piles Toggle Button */}
        <button
          onClick={() => setShowPileCaps(!showPileCaps)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showPileCaps
              ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Pile Cap Foundations & Combined Mat Caps"
        >
          <Box className="w-3.5 h-3.5 text-sky-400" />
          <span>Pile Caps {combinedPileCaps.length > 0 ? `(${combinedPileCaps.length} Comb)` : ''}</span>
        </button>

        {/* 3D Foundation Grade Tie Beams Toggle Button */}
        <button
          onClick={() => setShowGradeBeams(!showGradeBeams)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showGradeBeams
              ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Foundation Grade Tie Beams connecting pile caps"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Grade Beams</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-700 mx-1" />

        <button
          onClick={() => toggleFilterLayer('showBeams')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            filterLayers.showBeams ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          Beams
        </button>
        <button
          onClick={() => toggleFilterLayer('showColumns')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            filterLayers.showColumns ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Columns
        </button>
        <button
          onClick={() => toggleFilterLayer('showSupports')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            filterLayers.showSupports ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          Supports
        </button>
      </div>

      {/* Floating Action Banner: Merge Selected Pile Caps (When >= 2 supports selected) */}
      {selectedSupportNodeIds.length >= 2 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-deep-navy/95 backdrop-blur-md border border-amber-500/70 p-4 rounded-xl shadow-2xl z-30 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in slide-in-from-bottom-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600 rounded-lg shadow">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>{selectedSupportNodeIds.length} PILE CAPS SELECTED</span>
                <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 rounded text-[10px]">
                  IS 2911 / IS 456
                </span>
              </div>
              <div className="text-[11px] text-amber-200/90 font-sans mt-0.5">
                Columns: <strong>{selectedSupportNodeIds.map((nid) => columnSupportMapping.get(nid)?.columnLabel || `Joint #${nid}`).join(', ')}</strong> • Merge into single rigid combined cap
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearSelectedSupportNodes()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mergeSelectedPileCaps()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-all"
            >
              <Link2 className="w-4 h-4" />
              <span>Design Combined Pile Cap</span>
            </button>
          </div>
        </div>
      )}

      {/* Single Support Floating HUD */}
      {selectedSupportNodeIds.length === 1 && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-sky-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-sky-700 text-white rounded font-bold text-xs">
                SUPPORT {columnSupportMapping.get(selectedSupportNodeIds[0])?.columnLabel || `Joint #${selectedSupportNodeIds[0]}`}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-semibold text-xs border border-slate-700">
                {columnSupportMapping.get(selectedSupportNodeIds[0])?.pileCapLabel || `PC-${selectedSupportNodeIds[0]}`}
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Hold Shift or click Multi-Select to select multiple pile caps to merge into a combined cap.
            </span>
          </div>
          <button
            onClick={() => clearSelectedSupportNodes()}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Member Floating Unified HUD Badge */}
      {selectedMember && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-amber-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-emerald-700 text-white rounded font-bold text-xs">
                {selectedColInfo ? `COLUMN ${selectedColInfo.columnLabel}` : `MEMBER #${selectedMember.id}`}
              </span>
              {selectedColInfo && (
                <>
                  <span className="px-2 py-0.5 bg-sky-800 text-sky-100 rounded font-bold text-xs">
                    JOINT {selectedColInfo.jointLabel}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                    PILE CAP {selectedColInfo.pileCapLabel}
                  </span>
                </>
              )}
            </div>
            <span className="text-slate-300 block text-[11px]">
              {selectedMember.classification} • {selectedMember.section.name || '300x450 mm'} • Length: {selectedMember.length.toFixed(2)} m
              {selectedColInfo && ` • ${selectedColInfo.gridLabel}`}
            </span>
          </div>
          <button
            onClick={() => selectMember(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Grade Beam Floating HUD Badge */}
      {selectedGradeBeam && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-indigo-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-indigo-700 text-white rounded font-bold text-xs">
                GRADE BEAM {selectedGradeBeam.gradeBeamId}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-semibold text-xs border border-slate-700">
                {selectedGradeBeam.startPileCapLabel} ({selectedGradeBeam.startColumnLabel}) ↔ {selectedGradeBeam.endPileCapLabel} ({selectedGradeBeam.endColumnLabel})
              </span>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded font-bold text-xs border border-emerald-500/40">
                {selectedGradeBeam.status}
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Section: <strong className="text-white">{selectedGradeBeam.b}×{selectedGradeBeam.D} mm</strong> • Span: <strong className="text-white">{selectedGradeBeam.spanLength.toFixed(2)} m</strong> • P_tie: <strong className="text-emerald-400">{selectedGradeBeam.factoredTensionTiePu} kN</strong> • Mu: <strong className="text-sky-300">{selectedGradeBeam.factoredDesignMomentMu} kNm</strong>
            </span>
            <span className="text-slate-400 block text-[10px] mt-0.5">
              Top: <span className="text-red-400 font-bold">{selectedGradeBeam.topRebarCallout}</span> • Bot: <span className="text-orange-400 font-bold">{selectedGradeBeam.bottomRebarCallout}</span> • Ties: <span className="text-emerald-400">{selectedGradeBeam.stirrupCallout}</span>
            </span>
          </div>
          <button
            onClick={() => setSelectedGradeBeamId(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Plate (Shear Wall SW-... or Floor Slab) HUD */}
      {selectedPlateId && activeModel?.plates.get(selectedPlateId) && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-violet-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-white rounded font-bold text-xs ${
                activeModel.plates.get(selectedPlateId)?.classification === 'WALL' ? 'bg-violet-700' : 'bg-sky-700'
              }`}>
                {(() => {
                  const pl: any = activeModel.plates.get(selectedPlateId);
                  return pl.classification === 'WALL' ? `LIFT CORE SHEAR WALL SW-${selectedPlateId}` : `FLOOR SLAB PLATE #${selectedPlateId}`;
                })()}
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                {(() => {
                  const pl: any = activeModel.plates.get(selectedPlateId);
                  const th = Math.round((pl.thickness || 0.15) * 1000);
                  return `${th}mm THK`;
                })()}
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              {(() => {
                const pl: any = activeModel.plates.get(selectedPlateId);
                const pts = pl.nodeIds.map((id: any) => activeModel.nodes.get(id)).filter(Boolean) as any[];
                if (pts.length >= 3) {
                  const xs = pts.map((n: any) => n.x), zs = pts.map((n: any) => n.z);
                  const dx = (Math.max(...xs) - Math.min(...xs)).toFixed(2), dz = (Math.max(...zs) - Math.min(...zs)).toFixed(2);
                  const ys = pts.map((n: any) => n.y), dy = (Math.max(...ys) - Math.min(...ys)).toFixed(2);
                  return pl.classification === 'WALL'
                    ? `Nodes: ${pl.nodeIds.join(', ')} • Wall Width: ${Math.max(parseFloat(dx), parseFloat(dz)).toFixed(2)}m • Story Height: ${dy}m`
                    : `Nodes: ${pl.nodeIds.join(', ')} • Plan Span: ${dx}m × ${dz}m • Elev Y: ${ys[0]?.toFixed(2)}m`;
                }
                return `Nodes: ${pl.nodeIds.join(', ')}`;
              })()}
            </span>
          </div>
          <button onClick={() => (selectPlate as any)(null)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors">
            Deselect
          </button>
        </div>
      )}

      {/* Bottom Right Coordinate HUD */}
      <div className="absolute bottom-4 right-4 bg-deep-navy/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded text-[11px] font-mono text-slate-400 z-10 flex items-center gap-3">
        <span className="flex items-center gap-1 text-emerald-400">
          <Zap className="w-3 h-3 text-amber-400" />
          High-Speed 3D Engine
        </span>
        <span>Columns: {activeModel?.statistics.totalColumns || 0}</span>
        <span>Combined Caps: {combinedPileCaps.length}</span>
        <span>Supports: {activeModel?.statistics.totalSupports || 0}</span>
      </div>
    </div>
  );
};
