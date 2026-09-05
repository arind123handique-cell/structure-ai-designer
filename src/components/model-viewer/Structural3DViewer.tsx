// @ts-nocheck
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useProjectStore } from '@/features/projects/projectStore';
import { Member3D, Node3D } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { GradeBeamDesignEngine } from '@/features/design/gradebeam/gradeBeamEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { PileDesignEngine } from '@/features/design/pile/pileDesignEngine';
import { CombinedPileCapEngine, CombinedPileCapGroup } from '@/features/design/pilecap/combinedPileCapEngine';
import { StaircaseDesignEngine } from '@/features/design/staircase/staircaseEngine';
import { Architectural3DLayer } from '@/features/architectural/3d/Architectural3DLayer';
import { buildMemberReinforcement, createReinforcementShared, disposeReinforcementShared } from './Reinforcement3DRenderer';
import { MemberDetailsDrawer } from './MemberDetailsDrawer';
import { PlateDetailsDrawer } from './PlateDetailsDrawer';
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
  DoorOpen,
  AppWindow,
  Footprints,
} from 'lucide-react';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useVideoStore } from '@/features/video/videoStore';
import { VideoViewportOverlay } from '@/features/video/components/VideoViewportOverlay';
import { CinematicRecorderControl } from '@/features/video/components/CinematicRecorderControl';
import { cyberAudio } from '@/features/video/audio/cyberAudioSynthesizer';
import { videoStreamEngine } from '@/features/video/engines/videoStreamEngine';
import { cvDefectDetector } from '@/features/video/engines/cvDefectDetector';
import { useThemeStore } from '@/features/theme/themeStore';
import { LruCache } from '@/utils/memoryManager';

// Bounded LRU texture cache for 3D sprites to avoid memory leaks and cap RAM usage
const spriteTextureCache = new LruCache<string, THREE.CanvasTexture>(30, (tex) => tex.dispose());

/**
 * Traverses and deeply disposes Three.js geometries, materials, and non-cached textures
 * to prevent GPU/RAM memory leaks. Preserves persistent shared geometries and materials.
 */
function disposeThreeObject(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.geometry && !child.geometry.userData?.isShared) {
      child.geometry.dispose();
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m: any) => {
        if (!m.userData?.isShared) {
          m.dispose();
        }
      });
    }
  });
}

/**
 * Creates lightweight, high-visibility 2D canvas texture sprite for 3D viewport labels.
 * Utilizes memoized canvas texture cache to eliminate memory fragmentation and GC freezing.
 */
function createTextBadgeSprite(
  primaryText: string,
  secondaryText: string | null = null,
  bgColor: string = '#047857',
  borderColor: string = '#10b981',
  textColor: string = '#ffffff'
): THREE.Sprite {
  const cacheKey = `${primaryText}__${secondaryText || ''}__${bgColor}__${borderColor}__${textColor}`;
  let texture = spriteTextureCache.get(cacheKey);

  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext ? canvas.getContext('2d') : null;
    } catch (e) {
      ctx = null;
    }

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

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    spriteTextureCache.set(cacheKey, texture);
  }

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

  // Shared persistent unit geometries to avoid per-member BufferGeometry allocations
  const sharedGeometriesRef = useRef<{
    unitBox: THREE.BoxGeometry;
    unitEdges: THREE.EdgesGeometry;
    supportCone: THREE.ConeGeometry;
    unitCylinder: THREE.CylinderGeometry;
    unitCone: THREE.ConeGeometry;
  }>({
    unitBox: Object.assign(new THREE.BoxGeometry(1, 1, 1), { userData: { isShared: true } }),
    unitEdges: Object.assign(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), { userData: { isShared: true } }),
    supportCone: Object.assign(new THREE.ConeGeometry(0.35, 0.6, 4), { userData: { isShared: true } }),
    unitCylinder: Object.assign(new THREE.CylinderGeometry(1, 1, 1, 6), { userData: { isShared: true } }),
    unitCone: Object.assign(new THREE.ConeGeometry(1, 1, 6), { userData: { isShared: true } }),
  });

  // Shared persistent materials to avoid reallocating on every render & selection
  const materialsRef = useRef({
    beam: Object.assign(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1 }), { userData: { isShared: true } }),
    column: Object.assign(new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.1 }), { userData: { isShared: true } }),
    selected: Object.assign(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5, roughness: 0.2 }), { userData: { isShared: true } }),
    slabPlate: Object.assign(new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.5,
    }), { userData: { isShared: true } }),
    wallPlate: Object.assign(new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }), { userData: { isShared: true } }),
    selectedPlate: Object.assign(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), { userData: { isShared: true } }),
    support: Object.assign(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.7 }), { userData: { isShared: true } }),
    selectedSupport: Object.assign(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6, roughness: 0.2 }), { userData: { isShared: true } }),
    pileCap: Object.assign(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.1 }), { userData: { isShared: true } }),
    selectedPileCap: Object.assign(new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0xb45309, emissiveIntensity: 0.4, roughness: 0.3 }), { userData: { isShared: true } }),
    pile: Object.assign(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.25 }), { userData: { isShared: true } }),
    // Shared line materials for crisp structural outlines
    edgeBeam: Object.assign(new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 1 }), { userData: { isShared: true } }),
    edgeColumn: Object.assign(new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 1 }), { userData: { isShared: true } }),
    edgeSelected: Object.assign(new THREE.LineBasicMaterial({ color: 0xfde047, linewidth: 1 }), { userData: { isShared: true } }),
    // Grade Beams
    gradeBeam: Object.assign(new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.35, metalness: 0.2 }), { userData: { isShared: true } }),
    selectedGradeBeam: Object.assign(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.4, roughness: 0.25 }), { userData: { isShared: true } }),
    edgeGradeBeam: Object.assign(new THREE.LineBasicMaterial({ color: 0x818cf8, linewidth: 1 }), { userData: { isShared: true } }),
    edgeSelectedGradeBeam: Object.assign(new THREE.LineBasicMaterial({ color: 0xfde68a, linewidth: 1 }), { userData: { isShared: true } }),
    // Pile Caps edges & combined caps
    edgePileCap: Object.assign(new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1 }), { userData: { isShared: true } }),
    edgeSelectedPileCap: Object.assign(new THREE.LineBasicMaterial({ color: 0xfef08a, linewidth: 1 }), { userData: { isShared: true } }),
    combinedCap: Object.assign(new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.35, metalness: 0.2 }), { userData: { isShared: true } }),
    shearWallCombinedCap: Object.assign(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35, metalness: 0.2 }), { userData: { isShared: true } }),
    selectedCombinedCap: Object.assign(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.2 }), { userData: { isShared: true } }),
    edgeCombinedCap: Object.assign(new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 1.5 }), { userData: { isShared: true } }),
    edgeShearWallCombinedCap: Object.assign(new THREE.LineBasicMaterial({ color: 0xf87171, linewidth: 1.5 }), { userData: { isShared: true } }),
    edgeSelectedCombinedCap: Object.assign(new THREE.LineBasicMaterial({ color: 0xfde047, linewidth: 1.5 }), { userData: { isShared: true } }),
  });

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const needsSceneRenderRef = useRef(true);
  const composerRef = useRef<EffectComposer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const performRaycastSelectionRef = useRef<(clientX: number, clientY: number, isMulti: boolean) => void>(() => {});

  const isStreamActive = useVideoStore(s => s.isStreamActive);
  const videoSourceType = useVideoStore(s => s.videoSourceType);
  const isBloomEnabled = useVideoStore(s => s.isBloomEnabled);
  const isScanlinesEnabled = useVideoStore(s => s.isScanlinesEnabled);
  const underlayOpacity = useVideoStore(s => s.arCalibration.underlayOpacity);
  const isCvDetectionActive = useVideoStore(s => s.isCvDetectionActive);
  const theme = useThemeStore(s => s.theme);

  const arch3DLayerRef = useRef<Architectural3DLayer | null>(null);
  if (!arch3DLayerRef.current) {
    arch3DLayerRef.current = new Architectural3DLayer();
  }

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
    savedSlabDesigns,
    savedColumnDesigns,
    savedBeamDesigns,
    architecturalWalls,
    architecturalDoors,
    architecturalWindows,
    architecturalOpenings,
    architecturalRooms,
    architecturalStaircases,
    selectedArchitecturalId,
    selectArchitecturalElement,
  } = useProjectStore() as any;

  const [showLabels, setShowLabels] = useState(false);
  const [showWallLabels, setShowWallLabels] = useState(false);
  const [showSlabLabels, setShowSlabLabels] = useState(false);
  const [showPileCaps, setShowPileCaps] = useState(true);
  const [showGradeBeams, setShowGradeBeams] = useState(true);
  const [showSlabs, setShowSlabs] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [showArchWalls, setShowArchWalls] = useState(true);
  const [showArchDoors, setShowArchDoors] = useState(true);
  const [showArchWindows, setShowArchWindows] = useState(true);
  const [showArchRooms, setShowArchRooms] = useState(false);
  const [showArchStaircases, setShowArchStaircases] = useState(true);
  const [selectedGradeBeamId, setSelectedGradeBeamId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const multiSelectModeRef = useRef(multiSelectMode);
  multiSelectModeRef.current = multiSelectMode;

  // 3D Reinforcement detailing toggles (real-time ON/OFF per component)
  const [rebarEnabled, setRebarEnabled] = useState(false);
  const [rebarShowColumnBars, setRebarShowColumnBars] = useState(true);
  const [rebarShowColumnTies, setRebarShowColumnTies] = useState(true);
  const [rebarShowBeamBars, setRebarShowBeamBars] = useState(true);
  const [rebarShowBeamStirrups, setRebarShowBeamStirrups] = useState(true);

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

  // Diaphragm Levels from STAAD model
  const diaphragmLevels = useMemo(() => {
    return StaircaseDesignEngine.extractDiaphragmLevels(activeModel);
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

    const isLight = useThemeStore.getState().theme === 'light';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLight ? '#F1F5F9' : '#0F172A');
    sceneRef.current = scene;

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    dynamicGroupRef.current = dynamicGroup;

    if (arch3DLayerRef.current) {
      scene.add(arch3DLayerRef.current.getGroup());
    }

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(30, 25, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rendererRef.current = renderer;
    canvasRef.current = renderer.domElement;

    containerRef.current.replaceChildren(renderer.domElement);

    // Setup Cyberpunk Post-Processing (UnrealBloomPass) - opt-in
    try {
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.75, // bloom strength
        0.3,  // bloom radius
        0.5   // bloom threshold
      );
      composer.addPass(bloomPass);
      composerRef.current = composer;
    } catch (e) {
      console.warn('EffectComposer bloom init skipped', e);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 1500;
    controls.minDistance = 2;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controlsRef.current = controls;

    // Native pointer click/drag discriminator directly on WebGL canvas
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;

    const onPointerDownNative = (e: PointerEvent) => {
      if (e.button === 0) {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        pointerDownTime = Date.now();
      }
    };

    const onPointerUpNative = (e: PointerEvent) => {
      if (e.button === 0) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - pointerDownTime;
        // Tolerant click discrimination for high-DPI screens, mice & touchpads (< 14px movement, < 2500ms)
        if (dist < 14 && elapsed < 2500) {
          performRaycastSelectionRef.current(e.clientX, e.clientY, e.shiftKey || e.ctrlKey || multiSelectModeRef.current);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDownNative);
    renderer.domElement.addEventListener('pointerup', onPointerUpNative);

    controls.addEventListener('change', () => {
      needsSceneRenderRef.current = true;
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(50, 80, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-50, -30, -50);
    scene.add(dirLight2);

    // Tactical Ground Grid Helper
    const gridHelper = new THREE.GridHelper(100, 50, isLight ? 0x2563EB : 0x00f0ff, isLight ? 0xCBD5E1 : 0x1e293b);
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
          if (composerRef.current) {
            composerRef.current.setSize(w, h);
          }
          needsSceneRenderRef.current = true;
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // High-Performance Damped & On-Demand RAF Render Loop (0% idle CPU/GPU)
    let isMounted = true;
    let animationFrameId: number;

    const animate = () => {
      if (!isMounted) return;
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
        const controlsDamping = controlsRef.current.update();
        if (controlsDamping || needsSceneRenderRef.current) {
          const bloomActive = useVideoStore.getState().isBloomEnabled;
          if (bloomActive && composerRef.current) {
            composerRef.current.render();
          } else {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
          needsSceneRenderRef.current = false;
        }
      }
    };
    animate();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement?.removeEventListener('pointerdown', onPointerDownNative);
      renderer.domElement?.removeEventListener('pointerup', onPointerUpNative);
      controls.dispose();
      disposeThreeObject(scene);

      // Deeply dispose persistent shared geometries and materials on component unmount
      if (sharedGeometriesRef.current) {
        Object.values(sharedGeometriesRef.current).forEach((geom: any) => {
          if (geom && typeof geom.dispose === 'function') geom.dispose();
        });
      }
      if (materialsRef.current) {
        Object.values(materialsRef.current).forEach((mat: any) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }

      if (composerRef.current) {
        try {
          composerRef.current.renderTarget1?.dispose();
          composerRef.current.renderTarget2?.dispose();
        } catch {}
        composerRef.current = null;
      }
      renderer.dispose();
      try {
        renderer.forceContextLoss();
        renderer.domElement?.remove();
      } catch (e) {
        // ignore
      }
      spriteTextureCache.clear();
    };
  }, []);

  // Trigger re-render when bloom is toggled
  useEffect(() => {
    needsSceneRenderRef.current = true;
  }, [isBloomEnabled, isStreamActive]);

  // Synchronize 3D background color when theme toggles
  useEffect(() => {
    if (sceneRef.current) {
      const isLight = theme === 'light';
      sceneRef.current.background = new THREE.Color(isLight ? '#F1F5F9' : '#0F172A');
      needsSceneRenderRef.current = true;
    }
  }, [theme]);

  // Synchronize active video feed (simulated drone or live stream) into the background container
  useEffect(() => {
    if (!isStreamActive || !videoContainerRef.current) return;
    videoContainerRef.current.replaceChildren();

    let feedEl: HTMLElement | null = null;
    if (videoSourceType === 'SIMULATED_DRONE') {
      feedEl = videoStreamEngine.startSimulatedDroneFeed();
      feedEl.className = 'w-full h-full object-cover';
      videoContainerRef.current.appendChild(feedEl);
    } else {
      const v = videoStreamEngine.getVideoElement();
      if (v) {
        v.className = 'w-full h-full object-cover';
        videoContainerRef.current.appendChild(v);
      }
    }

    // Periodic Computer Vision crack / defect analysis (throttled)
    const interval = setInterval(async () => {
      if (!isCvDetectionActive) return;
      const target = videoSourceType === 'SIMULATED_DRONE' ? feedEl : videoStreamEngine.getVideoElement();
      if (target && (target instanceof HTMLCanvasElement || target instanceof HTMLVideoElement)) {
        const defects = await cvDefectDetector.analyzeVideoFrame(target);
        if (defects.length > 0) {
          defects.forEach((d) => useVideoStore.getState().addDefect(d));
        }
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      videoStreamEngine.stopSimulatedFeed();
      if (videoContainerRef.current) {
        videoContainerRef.current.replaceChildren();
      }
    };
  }, [isStreamActive, videoSourceType, isCvDetectionActive]);

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

    // Fresh reinforcement shared resources for THIS rebuild (disposed in cleanup).
    const reinforcementShared = rebarEnabled ? createReinforcementShared(0.01) : null;

    memberMeshesRef.current.clear();
    plateMeshesRef.current.clear();
    pileCapMeshesRef.current = [];
    supportConeMeshesRef.current = [];
    gradeBeamMeshesRef.current = [];

    const { nodes, members, plates, supports } = activeModel;

    // Shared persistent Low-Poly Geometries & Materials
    const {
      beam: beamMaterial,
      column: columnMaterial,
      selected: selectedMaterial,
      slabPlate: slabPlateMaterial,
      wallPlate: wallPlateMaterial,
      selectedPlate: selectedPlateMaterial,
      support: supportMaterial,
      selectedSupport: selectedSupportMaterial,
      pileCap: pileCapMaterial,
      selectedPileCap: selectedPileCapMaterial,
      pile: pileMat,
      edgeBeam: edgeBeamMaterial,
      edgeColumn: edgeColumnMaterial,
      edgeSelected: edgeSelectedMaterial,
      gradeBeam: gradeBeamMaterial,
      selectedGradeBeam: selectedGradeBeamMaterial,
      edgeGradeBeam: edgeGradeBeamMaterial,
      edgeSelectedGradeBeam: edgeSelectedGradeBeamMaterial,
      edgePileCap: edgePileCapMaterial,
      edgeSelectedPileCap: edgeSelectedPileCapMaterial,
      combinedCap: combinedCapMaterial,
      shearWallCombinedCap: shearWallCombinedCapMaterial,
      selectedCombinedCap: selectedCombinedCapMaterial,
      edgeCombinedCap: edgeCombinedCapMaterial,
      edgeShearWallCombinedCap: edgeShearWallCombinedCapMaterial,
      edgeSelectedCombinedCap: edgeSelectedCombinedCapMaterial,
    } = materialsRef.current;

    const sharedGeoms = sharedGeometriesRef.current;

    // 1. Draw Members with exact designed structural cross-section dimensions (b × D)
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

      // Extract exact designed section dimensions (b × D) from saved designs or member section
      let b = 0.3;
      let D = 0.45;

      if (isCol) {
        const colDesign = savedColumnDesigns ? savedColumnDesigns[member.id] : null;
        if (colDesign && (colDesign.b || colDesign.bMm)) {
          const rawB = colDesign.b || colDesign.bMm;
          const rawD = colDesign.D || colDesign.dMm;
          b = rawB > 5 ? rawB / 1000 : rawB;
          D = rawD > 5 ? rawD / 1000 : rawD;
        } else {
          b = member.section.zd ? (member.section.zd > 5 ? member.section.zd / 1000 : member.section.zd) : 0.45;
          D = member.section.yd ? (member.section.yd > 5 ? member.section.yd / 1000 : member.section.yd) : 0.55;
        }
      } else {
        const beamDesign = savedBeamDesigns ? savedBeamDesigns[member.id] : null;
        if (beamDesign && (beamDesign.b || beamDesign.bMm)) {
          const rawB = beamDesign.b || beamDesign.bMm;
          const rawD = beamDesign.D || beamDesign.dMm;
          b = rawB > 5 ? rawB / 1000 : rawB;
          D = rawD > 5 ? rawD / 1000 : rawD;
        } else {
          b = member.section.zd ? (member.section.zd > 5 ? member.section.zd / 1000 : member.section.zd) : 0.30;
          D = member.section.yd ? (member.section.yd > 5 ? member.section.yd / 1000 : member.section.yd) : 0.45;
        }
      }

      const isSelected = selectedMemberId === member.id;
      const material = isSelected ? selectedMaterial : isCol ? columnMaterial : beamMaterial;

      // High-performance shared unit box geometry with scale sizing (0 heap buffer allocation)
      const mesh = new THREE.Mesh(sharedGeoms.unitBox, material);
      mesh.scale.set(b, distance, D);

      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mesh.position.copy(midpoint);

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      mesh.userData = {
        memberId: member.id,
        type: 'member',
        isColumn: isCol,
        b: Math.round(b * 1000),
        D: Math.round(D * 1000),
        sectionName: `${Math.round(b * 1000)}×${Math.round(D * 1000)} mm`,
      };
      dynamicGroup.add(mesh);
      memberMeshesRef.current.set(member.id, mesh);

      // Add crisp edges geometry lines using shared unit edges and shared edge material
      const edgeMat = isSelected ? edgeSelectedMaterial : isCol ? edgeColumnMaterial : edgeBeamMaterial;
      const edgeLine = new THREE.LineSegments(sharedGeoms.unitEdges, edgeMat);
      edgeLine.scale.copy(mesh.scale);
      edgeLine.position.copy(mesh.position);
      edgeLine.quaternion.copy(mesh.quaternion);
      edgeLine.userData = { memberId: member.id, type: 'member', isColumn: isCol };
      dynamicGroup.add(edgeLine);
      mesh.userData.edgeLine = edgeLine;

      // ---- 3D Reinforcement detailing (per-member rebar) ----
      if (rebarEnabled && reinforcementShared) {
        const colDesign = !isCol ? null : savedColumnDesigns?.[member.id];
        const beamDesign = isCol ? null : savedBeamDesigns?.[member.id];
        const colRebar = colDesign?.rebar;
        const coverMm = colDesign?.cover ?? (isCol ? 40 : 30);

        // Default rebar fallback when no design saved — 4-T20 corners + ties / 2-T20 top-bottom + stirrups
        const fallbackColRebar = {
          cornerBars: { diameter: 20, count: 4, callout: '4-T20', area: 1256.6 },
          faceBars: undefined,
          totalBars: 4,
        };
        const fallbackBeamTop = [{ diameter: 20, count: 2 }];
        const fallbackBeamBot = [{ diameter: 20, count: 2 }];
        const fallbackStirrupSpacing = 150;

        const rfSpec = {
          memberId: member.id,
          isColumn: isCol,
          b,
          D,
          length: distance,
          coverMm,
          columnRebar: colRebar || (isCol ? fallbackColRebar : undefined),
          beamTopBars: isCol ? undefined : (beamDesign?.topRebar?.bars || fallbackBeamTop),
          beamBottomBars: isCol ? undefined : (beamDesign?.bottomRebar?.bars || fallbackBeamBot),
          stirrupSpacingMm: isCol ? undefined : (beamDesign?.shear?.stirrupSpacing || fallbackStirrupSpacing),
          stirrupDiameterMm: isCol ? undefined : (beamDesign?.shear?.stirrupDiameter || 8),
        };
        const rfGroup = buildMemberReinforcement(
          rfSpec,
          {
            showColumnBars: rebarShowColumnBars,
            showColumnTies: rebarShowColumnTies,
            showBeamBars: rebarShowBeamBars,
            showBeamStirrups: rebarShowBeamStirrups,
          },
          reinforcementShared
        );
        if (rfGroup) {
          rfGroup.position.copy(mesh.position);
          rfGroup.quaternion.copy(mesh.quaternion);
          // Tag so clicking on rebar also selects the member (inherited by children)
          rfGroup.userData.memberId = member.id;
          rfGroup.userData.rfType = 'rebar';
          dynamicGroup.add(rfGroup);
        }
      }

      if (isCol && showLabels) {
        const isGroundCol = supports.has(member.startNodeId) || supports.has(member.endNodeId);
        if (isGroundCol) {
          const colInfo = columnMemberMapping.get(member.id);
          const colLabel = colInfo?.columnLabel || `C${member.id}`;
          const secLabel = `${Math.round(b * 1000)}×${Math.round(D * 1000)}`;
          const sprite = createTextBadgeSprite(colLabel, secLabel, '#064e3b', '#10b981', '#ffffff');
          sprite.position.copy(midpoint);
          sprite.position.y += 0.3;
          dynamicGroup.add(sprite);
        }
      }
    });

    // Build panel ID mapping for horizontal slab plates to support instant deletion in 3D
    const horizontalSlabPlates = Array.from(plates.values()).filter(
      (p: any) => p.classification !== 'WALL' && !p.isLiftCore
    );
    const slabFloorMap = new Map<number, typeof horizontalSlabPlates>();
    horizontalSlabPlates.forEach((p) => {
      const pNodes = p.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as Node3D[];
      if (pNodes.length > 0) {
        const avgY = Math.round((pNodes.reduce((acc, n) => acc + n.y, 0) / pNodes.length) * 10) / 10;
        if (!slabFloorMap.has(avgY)) slabFloorMap.set(avgY, []);
        slabFloorMap.get(avgY)!.push(p);
      }
    });

    const plateToPanelIdMap = new Map<number, string>();
    let pIdx = 1;
    const sortedElevs = Array.from(slabFloorMap.keys()).sort((a, b) => a - b);
    sortedElevs.forEach((yElev) => {
      const platesAtFloor = slabFloorMap.get(yElev)!;
      platesAtFloor.forEach((p) => {
        plateToPanelIdMap.set(p.id, `S${pIdx++}`);
      });
    });

    const activeSlabPanelSet =
      savedSlabDesigns && Object.keys(savedSlabDesigns).length > 0
        ? new Set(Object.keys(savedSlabDesigns))
        : null;

    // 2. Draw Plates — strictly differentiated: horizontal SLABS vs vertical SHEAR WALLS (Lift Core)
    if (filterLayers.showPlates) {
      plates.forEach((plate) => {
        const isWallPlate = plate.classification === 'WALL';
        if (isWallPlate && !showWalls) return;
        if (!isWallPlate && !showSlabs) return;

        // If slab panel was deleted in Slab Design workspace, do NOT render in 3D model
        if (!isWallPlate && activeSlabPanelSet) {
          const panelId = plateToPanelIdMap.get(plate.id);
          if (panelId && !activeSlabPanelSet.has(panelId)) {
            return;
          }
        }

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

    // 2c. Slab Numbers / Badges in 3D Model — respects showSlabLabels on/off switch and deleted slabs
    if (showSlabLabels && showSlabs && filterLayers.showPlates) {
      let slabLabelCount = 1;
      const slabPlates = Array.from(plates.values()).filter(
        (p: any) => p.classification !== 'WALL' && !p.isLiftCore
      );

      const seenCenters: { x: number; y: number; z: number }[] = [];

      slabPlates.forEach((plate: any) => {
        const panelId = plateToPanelIdMap.get(plate.id);
        if (panelId && activeSlabPanelSet && !activeSlabPanelSet.has(panelId)) {
          return; // Skip deleted slab label
        }

        const pNodes = plate.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as Node3D[];
        if (pNodes.length < 3) return;

        const cx = pNodes.reduce((s: number, n: Node3D) => s + n.x, 0) / pNodes.length;
        const cy = pNodes.reduce((s: number, n: Node3D) => s + n.y, 0) / pNodes.length;
        const cz = pNodes.reduce((s: number, n: Node3D) => s + n.z, 0) / pNodes.length;

        // Prevent overlapping badges for fine-meshed sub-plates within 2.2m radius
        const isDuplicate = seenCenters.some(
          (c) => Math.abs(c.y - cy) < 0.4 && Math.hypot(c.x - cx, c.z - cz) < 2.2
        );
        if (isDuplicate) return;

        seenCenters.push({ x: cx, y: cy, z: cz });

        const slabName = panelId || `S${slabLabelCount++}`;
        const thk = Math.round((plate.thickness || 0.13) * 1000);
        const isSelected = selectedPlateId === plate.id;

        const sprite = createTextBadgeSprite(
          slabName,
          `${thk}mm SLAB`,
          isSelected ? '#c2410c' : '#1e3a8a',
          isSelected ? '#ea580c' : '#3b82f6',
          '#ffffff'
        );
        sprite.position.set(cx, cy + 0.35, cz);
        dynamicGroup.add(sprite);
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
        const coneMesh = new THREE.Mesh(sharedGeoms.supportCone, isSelected ? selectedSupportMaterial : supportMaterial);
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

          let capMesh: THREE.Mesh;
          let capLine: THREE.LineSegments;

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
            const capGeom = new THREE.ExtrudeGeometry(shape, { depth: capDepth, bevelEnabled: false });
            capGeom.rotateX(-Math.PI / 2);
            capGeom.translate(0, -capDepth, 0);

            capMesh = new THREE.Mesh(capGeom, isSelected ? selectedPileCapMaterial : pileCapMaterial);
            const capEdges = new THREE.EdgesGeometry(capGeom);
            capLine = new THREE.LineSegments(
              capEdges,
              isSelected ? edgeSelectedPileCapMaterial : edgePileCapMaterial
            );
          } else {
            // Standard rectangular pile cap: uses shared unitBox & unitEdges with 0 geometry allocation
            capMesh = new THREE.Mesh(sharedGeoms.unitBox, isSelected ? selectedPileCapMaterial : pileCapMaterial);
            capMesh.scale.set(capWidth, capDepth, capLength);
            capMesh.position.set(0, -capDepth / 2, 0);

            capLine = new THREE.LineSegments(
              sharedGeoms.unitEdges,
              isSelected ? edgeSelectedPileCapMaterial : edgePileCapMaterial
            );
            capLine.scale.copy(capMesh.scale);
            capLine.position.copy(capMesh.position);
          }

          capMesh.userData = { type: 'support', nodeId: supp.nodeId };
          capGroup.add(capMesh);
          capGroup.add(capLine);
          capGroup.userData = { type: 'support', nodeId: supp.nodeId };

          // Piles: use shared unitCylinder and unitCone with scaling
          pileOffsets.forEach((off) => {
            const shaftMesh = new THREE.Mesh(sharedGeoms.unitCylinder, pileMat);
            shaftMesh.scale.set(pileRadius, pileLength, pileRadius);
            shaftMesh.position.set(off.x, -capDepth - pileLength / 2, off.z);
            capGroup.add(shaftMesh);

            const toeMesh = new THREE.Mesh(sharedGeoms.unitCone, pileMat);
            toeMesh.scale.set(pileRadius, 0.35, pileRadius);
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
          combGroup.userData = {
            type: 'combinedPileCap',
            groupId: grp.groupId,
            nodeIds: grp.nodeIds,
            isShearWall,
          };

          const combMat = isSelected
            ? selectedCombinedCapMaterial
            : isShearWall
            ? shearWallCombinedCapMaterial
            : combinedCapMaterial;

          const combMesh = new THREE.Mesh(sharedGeoms.unitBox, combMat);
          combMesh.scale.set(capL, capD, capB);
          combMesh.position.set(0, -capD / 2, 0);
          combMesh.userData = { type: 'combinedPileCap', groupId: grp.groupId, nodeIds: grp.nodeIds };
          combGroup.add(combMesh);

          const lineMat = isSelected
            ? edgeSelectedCombinedCapMaterial
            : isShearWall
            ? edgeShearWallCombinedCapMaterial
            : edgeCombinedCapMaterial;

          const line = new THREE.LineSegments(sharedGeoms.unitEdges, lineMat);
          line.scale.copy(combMesh.scale);
          line.position.copy(combMesh.position);
          combGroup.add(line);

          grp.pileOffsets.forEach((off) => {
            const px = off.x / 1000;
            const pz = -off.z / 1000;

            const shaftMesh = new THREE.Mesh(sharedGeoms.unitCylinder, pileMat);
            shaftMesh.scale.set(pileRadius, pileLength, pileRadius);
            shaftMesh.position.set(px, -capD - pileLength / 2, pz);
            combGroup.add(shaftMesh);

            const toeMesh = new THREE.Mesh(sharedGeoms.unitCone, pileMat);
            toeMesh.scale.set(pileRadius, 0.35, pileRadius);
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
        const boxMesh = new THREE.Mesh(
          sharedGeoms.unitBox,
          isSelected ? selectedGradeBeamMaterial : gradeBeamMaterial
        );
        boxMesh.scale.set(b, D, distance);
        boxMesh.position.set(0, -D / 2, 0);
        boxMesh.userData = { gradeBeamId: gb.gradeBeamId, type: 'gradebeam' };
        gbGroup.add(boxMesh);

        const edgeMat = isSelected ? edgeSelectedGradeBeamMaterial : edgeGradeBeamMaterial;
        const line = new THREE.LineSegments(sharedGeoms.unitEdges, edgeMat);
        line.scale.copy(boxMesh.scale);
        line.position.copy(boxMesh.position);
        gbGroup.add(line);

        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        gbGroup.position.copy(midpoint);

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const defaultForward = new THREE.Vector3(0, 0, 1);
        gbGroup.quaternion.setFromUnitVectors(defaultForward, dir);

        gbGroup.userData = { gradeBeamId: gb.gradeBeamId, type: 'gradebeam' };
        dynamicGroup.add(gbGroup);
        gradeBeamMeshesRef.current.push(gbGroup);
      });
    }

    // 5. Update Live 3D Architectural BIM & RCC Staircase Layer
    if (arch3DLayerRef.current) {
      arch3DLayerRef.current.update(
        architecturalWalls || {},
        architecturalDoors || {},
        architecturalWindows || {},
        architecturalOpenings || {},
        architecturalRooms || {},
        architecturalStaircases || {},
        selectedArchitecturalId,
        {
          showWalls: showArchWalls,
          showDoors: showArchDoors,
          showWindows: showArchWindows,
          showOpenings: true,
          showRoomLabels: showArchRooms,
          showStaircases: showArchStaircases,
          diaphragmLevels,
        }
      );
    }

    needsSceneRenderRef.current = true;

    return () => {
      if (reinforcementShared) {
        disposeReinforcementShared(reinforcementShared);
      }
    };
  }, [
    activeModel,
    filterLayers,
    showLabels,
    showWallLabels,
    showSlabLabels,
    showSlabs,
    showWalls,
    showPileCaps,
    showGradeBeams,
    showArchWalls,
    showArchDoors,
    showArchWindows,
    showArchRooms,
    showArchStaircases,
    architecturalWalls,
    architecturalDoors,
    architecturalWindows,
    architecturalOpenings,
    architecturalRooms,
    architecturalStaircases,
    diaphragmLevels,
    columnSupportMapping,
    columnMemberMapping,
    gradeBeamsList,
    combinedPileCaps,
    absorbedNodeMap,
    projectPileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    manualMergedPileCapGroups,
    savedSlabDesigns,
    savedColumnDesigns,
    savedBeamDesigns,
    rebarEnabled,
    rebarShowColumnBars,
    rebarShowColumnTies,
    rebarShowBeamBars,
    rebarShowBeamStirrups,
  ]);

  // High-Performance Instant Selection Highlighter (0.01ms - zero mesh reallocation)
  useEffect(() => {
    const mats = materialsRef.current;

    // 1. Members
    memberMeshesRef.current.forEach((mesh, id) => {
      const isSelected = id === selectedMemberId;
      const isCol = mesh.userData.isColumn;
      mesh.material = isSelected ? mats.selected : (isCol ? mats.column : mats.beam);
      if (mesh.userData.edgeLine) {
        mesh.userData.edgeLine.material = isSelected
          ? mats.edgeSelected
          : (isCol ? mats.edgeColumn : mats.edgeBeam);
      }
    });

    // 2. Plates
    plateMeshesRef.current.forEach((mesh, id) => {
      const isSelected = id === selectedPlateId;
      const isWall = mesh.userData.classification === 'WALL';
      mesh.material = isSelected ? mats.selectedPlate : (isWall ? mats.wallPlate : mats.slabPlate);
    });

    // 3. Support Cones
    supportConeMeshesRef.current.forEach((mesh) => {
      const isSelected = selectedSupportNodeIds.includes(mesh.userData.nodeId);
      mesh.material = isSelected ? mats.selectedSupport : mats.support;
    });

    // 4. Pile Caps & Combined Caps
    pileCapMeshesRef.current.forEach((group) => {
      const u = group.userData;
      const isSelected = u.nodeIds
        ? u.nodeIds.some((nid: number) => selectedSupportNodeIds.includes(nid))
        : (u.nodeId ? selectedSupportNodeIds.includes(u.nodeId) : false);

      const isCombined = u.type === 'combinedPileCap';
      const isShearWall = u.isShearWall;

      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.userData.type === 'support') {
            child.material = isSelected ? mats.selectedPileCap : mats.pileCap;
          } else if (child.userData.type === 'combinedPileCap') {
            child.material = isSelected
              ? mats.selectedCombinedCap
              : isShearWall
              ? mats.shearWallCombinedCap
              : mats.combinedCap;
          }
        } else if (child instanceof THREE.LineSegments) {
          if (isCombined) {
            child.material = isSelected
              ? mats.edgeSelectedCombinedCap
              : isShearWall
              ? mats.edgeShearWallCombinedCap
              : mats.edgeCombinedCap;
          } else {
            child.material = isSelected ? mats.edgeSelectedPileCap : mats.edgePileCap;
          }
        }
      });
    });

    // 5. Grade Beams
    gradeBeamMeshesRef.current.forEach((group) => {
      const isSelected = group.userData.gradeBeamId === selectedGradeBeamId;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.type === 'gradebeam') {
          child.material = isSelected ? mats.selectedGradeBeam : mats.gradeBeam;
        } else if (child instanceof THREE.LineSegments) {
          child.material = isSelected ? mats.edgeSelectedGradeBeam : mats.edgeGradeBeam;
        }
      });
    });

    needsSceneRenderRef.current = true;
  }, [selectedMemberId, selectedPlateId, selectedSupportNodeIds, selectedGradeBeamId]);

  const performRaycastSelection = useCallback(
    (clientX: number, clientY: number, isMulti: boolean) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      const dynamicGroup = dynamicGroupRef.current;
      if (!dynamicGroup) return;

      // Force world matrices to update for accurate raycast intersection with scaled unit geometries
      sceneRef.current.updateMatrixWorld(true);

      const targets: THREE.Object3D[] = [dynamicGroup];
      if (arch3DLayerRef.current) {
        targets.push(arch3DLayerRef.current.getGroup());
      }

      const intersects = raycasterRef.current.intersectObjects(targets, true);

      if (intersects.length > 0) {
        try {
          cyberAudio.playSelectChirp();
        } catch {
          /* audio optional */
        }

        // Priority 1: Check for structural beam / column (or rebar owned by a member)
        let hitTarget: THREE.Object3D | null = null;
        let resolvedMemberId: number | null = null;

        for (const item of intersects) {
          let node: THREE.Object3D | null = item.object;
          while (node && node !== dynamicGroup && node !== sceneRef.current) {
            if (node.userData && node.userData.memberId != null) {
              resolvedMemberId = Number(node.userData.memberId);
              hitTarget = node;
              break;
            }
            if (
              node.userData &&
              (node.userData.type === 'support' ||
                node.userData.type === 'gradebeam' ||
                node.userData.type === 'combinedPileCap')
            ) {
              hitTarget = node;
              break;
            }
            node = node.parent;
          }
          if (hitTarget) break;
        }

        // Priority 2: If no beam/column/support was hit, check for floor slab / shear wall plates or architectural elements
        if (!hitTarget) {
          for (const item of intersects) {
            let node: THREE.Object3D | null = item.object;
            while (node && node !== dynamicGroup && node !== sceneRef.current) {
              if (node.userData && (node.userData.plateId != null || node.userData.type != null)) {
                hitTarget = node;
                break;
              }
              node = node.parent;
            }
            if (hitTarget) break;
          }
        }

        if (hitTarget) {
          const u = hitTarget.userData;
          if (u.type === 'arch_wall') {
            selectArchitecturalElement(u.id, 'WALL');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'arch_door') {
            selectArchitecturalElement(u.id, 'DOOR');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'arch_window') {
            selectArchitecturalElement(u.id, 'WINDOW');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'arch_opening') {
            selectArchitecturalElement(u.id, 'OPENING');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'arch_room') {
            selectArchitecturalElement(u.id, 'ROOM');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'arch_staircase') {
            selectArchitecturalElement(u.id, 'STAIRCASE');
            selectMember(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'gradebeam' && u.gradeBeamId) {
            setSelectedGradeBeamId(u.gradeBeamId);
            selectMember(null);
            selectArchitecturalElement(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.type === 'combinedPileCap' && u.nodeIds) {
            const nodeIds: number[] = u.nodeIds;
            if (isMulti) {
              nodeIds.forEach((nid) => selectSupportNode(nid, true));
            } else {
              clearSelectedSupportNodes();
              nodeIds.forEach((nid) => selectSupportNode(nid, true));
            }
            selectMember(null);
            selectArchitecturalElement(null);
            setSelectedGradeBeamId(null);
          } else if (u.type === 'support' && u.nodeId) {
            selectSupportNode(Number(u.nodeId), isMulti);
            selectMember(null);
            selectArchitecturalElement(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
          } else if (u.type === 'plate' && u.plateId) {
            (selectPlate as any)(Number(u.plateId));
            selectMember(null);
            selectArchitecturalElement(null);
            setSelectedGradeBeamId(null);
            if (!isMulti) clearSelectedSupportNodes();
          } else if (u.memberId != null || resolvedMemberId != null) {
            const targetMemberId = resolvedMemberId ?? Number(u.memberId);
            selectMember(targetMemberId);
            selectArchitecturalElement(null);
            setSelectedGradeBeamId(null);
            (selectPlate as any)(null);
            if (!isMulti) {
              clearSelectedSupportNodes();
            }
          }
          return;
        }
      }

      // Clicked in empty space
      if (!isMulti) {
        selectMember(null);
        selectArchitecturalElement(null);
        setSelectedGradeBeamId(null);
        (selectPlate as any)(null);
        clearSelectedSupportNodes();
      }
    },
    [
      selectMember,
      selectPlate,
      selectArchitecturalElement,
      selectSupportNode,
      clearSelectedSupportNodes,
      multiSelectMode,
    ]
  );

  // Sync latest raycast selection function to ref for native DOM listener
  performRaycastSelectionRef.current = performRaycastSelection;

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

  // Safe member-drawer props (computed here, never throw)
  const drawerMemberId = selectedMemberId ?? null;
  const drawerIsColumn = !!(selectedMember && selectedMember.classification === 'COLUMN');
  const drawerColDesign = drawerMemberId ? savedColumnDesigns?.[drawerMemberId] : null;
  const drawerBeamDesign = drawerMemberId ? savedBeamDesigns?.[drawerMemberId] : null;
  const drawerBmm = ((() => {
    if (!selectedMember) return 300;
    const cd = savedColumnDesigns?.[drawerMemberId!];
    const bd = savedBeamDesigns?.[drawerMemberId!];
    const raw = cd?.b || cd?.bMm || bd?.b || bd?.bMm || selectedMember.section?.zd || 0.3;
    return raw > 5 ? Math.round(raw) : Math.round(raw * 1000);
  })());
  const drawerDmm = ((() => {
    if (!selectedMember) return 450;
    const cd = savedColumnDesigns?.[drawerMemberId!];
    const bd = savedBeamDesigns?.[drawerMemberId!];
    const raw = cd?.D || cd?.dMm || bd?.D || bd?.dMm || selectedMember.section?.yd || 0.45;
    return raw > 5 ? Math.round(raw) : Math.round(raw * 1000);
  })());
  const drawerLength = selectedMember?.length ?? 0;
  const drawerNode1 = selectedMember?.startNodeId ?? 0;
  const drawerNode2 = selectedMember?.endNodeId ?? 0;
  const drawerMemberForces = activeModel?.memberForces || [];

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-surface-dark font-sans min-h-0">
      {/* Video Stream Underlay (Live Drone / Camera Feed) */}
      {isStreamActive && (
        <div
          ref={videoContainerRef}
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center bg-black"
          style={{ opacity: arCalibration.underlayOpacity }}
        />
      )}

      {/* Cyberpunk CRT Scanlines Overlay */}
      {isScanlinesEnabled && (
        <div className="absolute inset-0 cyber-scanlines pointer-events-none z-10" />
      )}

      {/* Tactical Cyberpunk HUD Overlay */}
      <VideoViewportOverlay />

      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-crosshair flex-1 min-h-0 relative z-[5]"
        title="Click: select member • Drag: orbit • Scroll: zoom"
      />

      {/* Top Toolbar Controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-deep-navy/90 backdrop-blur-md border border-slate-700/60 p-1.5 rounded shadow-lg z-20 font-mono">
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
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        {/* In-Engine 4K Video Recorder */}
        <CinematicRecorderControl canvasRef={canvasRef} />
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

        {/* Slab Numbers / Labels Toggle — ON/OFF switch per user request */}
        <button
          onClick={() => setShowSlabLabels(!showSlabLabels)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showSlabLabels
              ? 'bg-blue-500/25 text-blue-300 border border-blue-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Floor Slab Numbers (S1, S2, S3, S4, S5...) — ON/OFF"
        >
          <Tag className="w-3.5 h-3.5 text-blue-400" />
          <span>Slab Numbers</span>
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

        {/* 3D Rebar Detail Master Toggle — ON/OFF switch for reinforcement graphical detailing */}
        <button
          onClick={() => setRebarEnabled(!rebarEnabled)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            rebarEnabled
              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Reinforcement Graphical Detailing (Rebar) — ON/OFF"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Rebar Detail</span>
        </button>

        {/* Per-component Rebar toggles — only active when Rebar Detail is ON */}
        {rebarEnabled && (
          <>
            <span className="text-[10px] uppercase tracking-wide text-amber-500/70 px-0.5">Rebar:</span>
            <button
              onClick={() => setRebarShowColumnBars(!rebarShowColumnBars)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                rebarShowColumnBars ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Column Longitudinal Bars (ON/OFF)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>Col Bars
            </button>
            <button
              onClick={() => setRebarShowColumnTies(!rebarShowColumnTies)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                rebarShowColumnTies ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Column Ties (ON/OFF)"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>Col Ties
            </button>
            <button
              onClick={() => setRebarShowBeamBars(!rebarShowBeamBars)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                rebarShowBeamBars ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Beam Main Bars (Top + Bottom) (ON/OFF)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>Beam Bars
            </button>
            <button
              onClick={() => setRebarShowBeamStirrups(!rebarShowBeamStirrups)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                rebarShowBeamStirrups ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Beam Stirrups (ON/OFF)"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>Stirrups
            </button>
          </>
        )}

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

        <div className="w-[1px] h-4 bg-slate-700 mx-1" />

        {/* Architectural 3D Layer Toggles */}
        <button
          onClick={() => setShowArchWalls(!showArchWalls)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showArchWalls
              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Architectural Walls"
        >
          <Box className="w-3.5 h-3.5 text-amber-400" />
          <span>Arch Walls {architecturalWalls && Object.keys(architecturalWalls).length > 0 ? `(${Object.keys(architecturalWalls).length})` : ''}</span>
        </button>

        <button
          onClick={() => setShowArchDoors(!showArchDoors)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showArchDoors
              ? 'bg-amber-600/25 text-amber-200 border border-amber-600/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Hosted Doors"
        >
          <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Doors {architecturalDoors && Object.keys(architecturalDoors).length > 0 ? `(${Object.keys(architecturalDoors).length})` : ''}</span>
        </button>

        <button
          onClick={() => setShowArchWindows(!showArchWindows)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showArchWindows
              ? 'bg-sky-500/25 text-sky-200 border border-sky-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Hosted Windows"
        >
          <AppWindow className="w-3.5 h-3.5 text-sky-400" />
          <span>Windows {architecturalWindows && Object.keys(architecturalWindows).length > 0 ? `(${Object.keys(architecturalWindows).length})` : ''}</span>
        </button>

        <button
          onClick={() => setShowArchRooms(!showArchRooms)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showArchRooms
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D Room Badges"
        >
          <Tag className="w-3.5 h-3.5 text-emerald-400" />
          <span>Rooms</span>
        </button>

        <button
          onClick={() => setShowArchStaircases(!showArchStaircases)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            showArchStaircases
              ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 3D RCC Staircases (Steps, Landing Slabs, Handrails, Walls & Doors)"
        >
          <Footprints className="w-3.5 h-3.5 text-amber-400" />
          <span>Staircases {architecturalStaircases && Object.keys(architecturalStaircases).length > 0 ? `(${Object.keys(architecturalStaircases).length})` : ''}</span>
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

      {/* Selected Architectural Wall Floating HUD */}
      {selectedArchitecturalId && architecturalWalls && architecturalWalls[selectedArchitecturalId] && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-amber-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold text-xs">
                ARCHITECTURAL WALL {selectedArchitecturalId}
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                {Math.round(architecturalWalls[selectedArchitecturalId].thickness * 1000)}mm {architecturalWalls[selectedArchitecturalId].wallType}
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Length: {(Math.hypot(architecturalWalls[selectedArchitecturalId].end.x - architecturalWalls[selectedArchitecturalId].start.x, architecturalWalls[selectedArchitecturalId].end.y - architecturalWalls[selectedArchitecturalId].start.y)).toFixed(2)}m • Height: {architecturalWalls[selectedArchitecturalId].height.toFixed(2)}m • Base EL: +{architecturalWalls[selectedArchitecturalId].baseElevation.toFixed(2)}m
            </span>
          </div>
          <button
            onClick={() => selectArchitecturalElement(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Architectural Door Floating HUD */}
      {selectedArchitecturalId && architecturalDoors && architecturalDoors[selectedArchitecturalId] && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-amber-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-amber-700 text-white rounded font-bold text-xs">
                DOOR {selectedArchitecturalId}
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                {Math.round(architecturalDoors[selectedArchitecturalId].width * 1000)} × {Math.round(architecturalDoors[selectedArchitecturalId].height * 1000)} mm
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Host: {architecturalDoors[selectedArchitecturalId].hostWallId} • Swing: {architecturalDoors[selectedArchitecturalId].swingDirection} • Type: {architecturalDoors[selectedArchitecturalId].doorType}
            </span>
          </div>
          <button
            onClick={() => selectArchitecturalElement(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Architectural Window Floating HUD */}
      {selectedArchitecturalId && architecturalWindows && architecturalWindows[selectedArchitecturalId] && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-sky-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-sky-700 text-white rounded font-bold text-xs">
                WINDOW {selectedArchitecturalId}
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                {Math.round(architecturalWindows[selectedArchitecturalId].width * 1000)} × {Math.round(architecturalWindows[selectedArchitecturalId].height * 1000)} mm
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Host: {architecturalWindows[selectedArchitecturalId].hostWallId} • Sill: {Math.round(architecturalWindows[selectedArchitecturalId].sillHeight * 1000)}mm • Type: {architecturalWindows[selectedArchitecturalId].windowType}
            </span>
          </div>
          <button
            onClick={() => selectArchitecturalElement(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Selected Architectural Room Floating HUD */}
      {selectedArchitecturalId && architecturalRooms && architecturalRooms[selectedArchitecturalId] && (
        <div className="absolute bottom-4 left-4 bg-deep-navy/95 backdrop-blur-md border border-emerald-500/50 p-3.5 rounded-lg shadow-2xl z-10 flex items-center gap-4 text-xs font-mono text-slate-200 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-emerald-700 text-white rounded font-bold text-xs">
                {architecturalRooms[selectedArchitecturalId].name}
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded font-bold text-xs">
                {architecturalRooms[selectedArchitecturalId].area.toFixed(2)} m² ({architecturalRooms[selectedArchitecturalId].roomType})
              </span>
            </div>
            <span className="text-slate-300 block text-[11px]">
              Perimeter: {architecturalRooms[selectedArchitecturalId].perimeter.toFixed(2)} m • Floor: {architecturalRooms[selectedArchitecturalId].floorId}
            </span>
          </div>
          <button
            onClick={() => selectArchitecturalElement(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
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

      {/* Controls Hint */}
      <div className="absolute bottom-4 left-4 bg-deep-navy/70 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded text-[10px] font-mono text-slate-500 z-10">
        <span className="text-emerald-400">Click</span> select · <span className="text-sky-400">Drag</span> orbit · <span className="text-slate-400">Scroll</span> zoom
      </div>

      {/* Member Details Drawer — opens when a structural member is selected */}
      {selectedMember && selectedMemberId && !selectedGradeBeamId && (
        <MemberDetailsDrawer
          memberId={drawerMemberId}
          isColumn={drawerIsColumn}
          b_mm={drawerBmm}
          D_mm={drawerDmm}
          length_m={drawerLength}
          node1Id={drawerNode1}
          node2Id={drawerNode2}
          colDesign={drawerColDesign}
          beamDesign={drawerBeamDesign}
          memberForces={drawerMemberForces}
          onClose={() => selectMember(null)}
        />
      )}

      {/* Plate Details Drawer — opens when a slab or shear wall is selected */}
      {selectedPlateId && activeModel?.plates.get(selectedPlateId) && (
        <PlateDetailsDrawer
          plate={activeModel.plates.get(selectedPlateId)!}
          nodes={(activeModel.plates.get(selectedPlateId)?.nodeIds || []).map((id: number) => activeModel.nodes.get(id))}
          onClose={() => (selectPlate as any)(null)}
        />
      )}
    </div>
  );
};
