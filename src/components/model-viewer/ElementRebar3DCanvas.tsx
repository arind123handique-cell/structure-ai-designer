import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Eye, Play, Pause, Sparkles, Box } from 'lucide-react';
import { getTruncated3PilePolygonMm } from '@/features/design/pilecap/pileCapGeometryUtils';

export type RebarElementType = 'BEAM' | 'COLUMN' | 'PILE_CAP' | 'PILE' | 'FOOTING' | 'SLAB';

export interface ElementRebar3DProps {
  elementType: RebarElementType;
  title: string;
  // Dimensions in meters
  width_m: number; // b or X
  depth_m: number; // D (elevation for beam/col or Z thickness for slab)
  length_m: number; // Span or height (Y or longitudinal)
  cover_mm?: number;
  // Rebar specs
  barCount?: number;
  barDiameter_mm?: number;
  topBarsCount?: number;
  topBarDiameter_mm?: number;
  botBarsCount?: number;
  botBarDiameter_mm?: number;
  tieSpacing_mm?: number;
  tieDiameter_mm?: number;
  pileCount?: number;
  pileDiameter_m?: number;
  pileOffsets?: { x: number; y: number }[];
}

export const ElementRebar3DCanvas: React.FC<ElementRebar3DProps> = ({
  elementType,
  title,
  width_m,
  depth_m,
  length_m,
  cover_mm = 40,
  barCount = 8,
  barDiameter_mm = 20,
  topBarsCount = 4,
  topBarDiameter_mm = 16,
  botBarsCount = 3,
  botBarDiameter_mm = 16,
  tieSpacing_mm = 150,
  tieDiameter_mm = 8,
  pileCount = 4,
  pileDiameter_m = 0.5,
  pileOffsets,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [ghostMode, setGhostMode] = useState<'XRAY' | 'SOLID' | 'REBAR_ONLY'>('XRAY');
  const autoRotateRef = useRef(false);
  autoRotateRef.current = autoRotate;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth || 400;
    const h = container.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 25;
    controls.minDistance = 0.2;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-5, -3, -5);
    scene.add(fillLight);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    grid.position.y = - (
      elementType === 'PILE' || elementType === 'COLUMN'
        ? length_m / 2 + 0.1
        : elementType === 'PILE_CAP'
        ? depth_m / 2 + 0.15 + 1.15   // cap half + PCC + pile shaft
        : depth_m / 2 + 0.1
    );
    scene.add(grid);

    // Root Element Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Materials
    const concreteOpacity = ghostMode === 'XRAY' ? 0.22 : ghostMode === 'SOLID' ? 0.85 : 0.0;
    const concreteMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: concreteOpacity,
      roughness: 0.2,
      metalness: 0.1,
      transmission: ghostMode === 'XRAY' ? 0.7 : 0,
      ior: 1.4,
      side: THREE.DoubleSide,
      depthWrite: ghostMode === 'SOLID',
    });

    const edgeMat = new THREE.LineBasicMaterial({
      color: ghostMode === 'REBAR_ONLY' ? 0x1e293b : 0x0284c7,
      transparent: true,
      opacity: ghostMode === 'REBAR_ONLY' ? 0.2 : 0.8,
    });

    const rebarMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Gold
      roughness: 0.25,
      metalness: 0.85,
      emissive: 0x78350f,
      emissiveIntensity: 0.2,
    });

    const stirrupMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Cyan / sky
      roughness: 0.35,
      metalness: 0.7,
    });

    const tieLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
    });

    const cover = (cover_mm || 40) / 1000;
    const b = Math.max(0.15, width_m);
    const D = Math.max(0.15, depth_m);
    const L = Math.max(0.3, length_m);

    // ──────────────── BUILD ELEMENT GEOMETRIES ────────────────
    if (elementType === 'BEAM') {
      // Beam concrete body (length along X, height Y, width Z)
      const concGeom = new THREE.BoxGeometry(L, D, b);
      const concMesh = new THREE.Mesh(concGeom, concreteMat);
      rootGroup.add(concMesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
      rootGroup.add(edges);

      // Rebar bounds inside concrete
      const hw = L / 2 - cover;
      const hd = D / 2 - cover;
      const hb = b / 2 - cover;

      const barRadius = (Math.max(12, botBarDiameter_mm) / 1000) / 2;
      const barGeom = new THREE.CylinderGeometry(barRadius, barRadius, L - 2 * cover, 10);
      barGeom.rotateZ(Math.PI / 2);

      // Top Bars (Continuous)
      const topCount = Math.max(2, topBarsCount);
      for (let i = 0; i < topCount; i++) {
        const z = -hb + (2 * hb * i) / (topCount - 1);
        const bar = new THREE.Mesh(barGeom, rebarMat);
        bar.position.set(0, hd, z);
        rootGroup.add(bar);
      }

      // Bottom Bars (Continuous)
      const botCount = Math.max(2, botBarsCount);
      for (let i = 0; i < botCount; i++) {
        const z = -hb + (2 * hb * i) / (botCount - 1);
        const bar = new THREE.Mesh(barGeom, rebarMat);
        bar.position.set(0, -hd, z);
        rootGroup.add(bar);
      }

      // Stirrup Rectangular Hoops along beam axis X
      const spacing = Math.max(0.1, (tieSpacing_mm || 150) / 1000);
      const stirrupCount = Math.min(60, Math.floor((L - 2 * cover) / spacing));
      const startX = -L / 2 + cover + spacing / 2;

      for (let i = 0; i <= stirrupCount; i++) {
        const x = startX + i * spacing;
        if (x > L / 2 - cover) break;

        const pts = [
          new THREE.Vector3(x, -hd, -hb),
          new THREE.Vector3(x, hd, -hb),
          new THREE.Vector3(x, hd, hb),
          new THREE.Vector3(x, -hd, hb),
          new THREE.Vector3(x, -hd, -hb),
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const ring = new THREE.Line(geom, tieLineMat);
        rootGroup.add(ring);
      }
    } else if (elementType === 'COLUMN') {
      // Column concrete body (vertical along Y, width X, depth Z)
      const concGeom = new THREE.BoxGeometry(b, L, D);
      const concMesh = new THREE.Mesh(concGeom, concreteMat);
      rootGroup.add(concMesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
      rootGroup.add(edges);

      const hw = b / 2 - cover;
      const hd = D / 2 - cover;
      const barRadius = (Math.max(12, barDiameter_mm) / 1000) / 2;
      const barGeom = new THREE.CylinderGeometry(barRadius, barRadius, L, 10);

      // Corner bars
      const cornerPositions = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ];
      cornerPositions.forEach(([x, z]) => {
        const bar = new THREE.Mesh(barGeom, rebarMat);
        bar.position.set(x, 0, z);
        rootGroup.add(bar);
      });

      // Intermediate face bars
      const extraBars = Math.max(0, barCount - 4);
      if (extraBars >= 2) {
        // Face along X
        const barX1 = new THREE.Mesh(barGeom, rebarMat);
        barX1.position.set(0, 0, -hd);
        rootGroup.add(barX1);

        const barX2 = new THREE.Mesh(barGeom, rebarMat);
        barX2.position.set(0, 0, hd);
        rootGroup.add(barX2);
      }
      if (extraBars >= 4) {
        // Face along Z
        const barZ1 = new THREE.Mesh(barGeom, rebarMat);
        barZ1.position.set(-hw, 0, 0);
        rootGroup.add(barZ1);

        const barZ2 = new THREE.Mesh(barGeom, rebarMat);
        barZ2.position.set(hw, 0, 0);
        rootGroup.add(barZ2);
      }

      // Lateral Ties (Rectangular hoops along Y)
      const spacing = Math.max(0.08, (tieSpacing_mm || 125) / 1000);
      const tieCount = Math.min(60, Math.floor(L / spacing));
      const startY = -L / 2 + spacing / 2;

      for (let i = 0; i <= tieCount; i++) {
        const y = startY + i * spacing;
        if (y > L / 2 - 0.05) break;

        const pts = [
          new THREE.Vector3(-hw, y, -hd),
          new THREE.Vector3(hw, y, -hd),
          new THREE.Vector3(hw, y, hd),
          new THREE.Vector3(-hw, y, hd),
          new THREE.Vector3(-hw, y, -hd),
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const ring = new THREE.Line(geom, tieLineMat);
        rootGroup.add(ring);
      }
    } else if (elementType === 'PILE_CAP') {
      // ══════════════════════════════════════════════════════════
      // 0. RESOLVE PILE GEOMETRY, OFFSETS & CAP ORIENTATION FIRST
      // ══════════════════════════════════════════════════════════
      const pDia = pileDiameter_m || 0.4;
      const pRad = pDia / 2;
      const overhangMin = pRad + 0.15; // standard min overhang (150mm clear concrete beyond pile edge)
      const toMeters = (v: number) => (Math.abs(v) > 5 ? v / 1000 : v);

      const dimLong = Math.max(b, length_m);
      const dimShort = Math.min(b, length_m);
      const s_est = Math.max(0.6, dimLong - 2 * overhangMin);

      const defaultOffsets: { x: number; y: number }[] = pileCount === 2
        ? [{ x: -s_est / 2, y: 0 }, { x: s_est / 2, y: 0 }]
        : pileCount === 3
        ? [
            { x: 0,          y:  s_est / Math.sqrt(3) },
            { x: -s_est / 2, y: -s_est / (2 * Math.sqrt(3)) },
            { x:  s_est / 2, y: -s_est / (2 * Math.sqrt(3)) },
          ]
        : pileCount === 6
        ? [
            { x: -s_est / 2, y: -s_est / 4 },
            { x: 0,          y: -s_est / 4 },
            { x:  s_est / 2, y: -s_est / 4 },
            { x: -s_est / 2, y:  s_est / 4 },
            { x: 0,          y:  s_est / 4 },
            { x:  s_est / 2, y:  s_est / 4 },
          ]
        : [ // 4-pile default
            { x: -s_est / 2, y: -s_est / 2 },
            { x:  s_est / 2, y: -s_est / 2 },
            { x: -s_est / 2, y:  s_est / 2 },
            { x:  s_est / 2, y:  s_est / 2 },
          ];

      const resolvedOffsets = (pileOffsets && pileOffsets.length > 0)
        ? pileOffsets.map((po) => ({ x: toMeters(po.x), y: toMeters(po.y) }))
        : defaultOffsets;

      const pileXs = resolvedOffsets.map((p) => p.x);
      const pileZs = resolvedOffsets.map((p) => p.y);
      const minPileX = Math.min(...pileXs);
      const maxPileX = Math.max(...pileXs);
      const minPileZ = Math.min(...pileZs);
      const maxPileZ = Math.max(...pileZs);
      const spanX = maxPileX - minPileX;
      const spanZ = maxPileZ - minPileZ;

      // Ensure cap dimensions along X and Z strictly enclose the piles with proper overhang
      const capD = D; // thickness/depth (Y)
      let capW: number; // size along X
      let capL: number; // size along Z

      if (pileCount === 2) {
        if (spanX >= spanZ) {
          // Piles along X axis -> cap long along X, short along Z
          capW = Math.max(dimLong, spanX + 2 * overhangMin);
          capL = Math.max(dimShort, pDia + 2 * 0.15);
        } else {
          // Piles along Z axis -> cap short along X, long along Z
          capW = Math.max(dimShort, pDia + 2 * 0.15);
          capL = Math.max(dimLong, spanZ + 2 * overhangMin);
        }
      } else if (pileCount === 3) {
        capW = Math.max(dimLong, spanX + 2 * overhangMin);
        capL = Math.max(dimShort, spanZ + 2 * overhangMin);
      } else if (pileCount === 6) {
        if (spanX >= spanZ) {
          capW = Math.max(dimLong, spanX + 2 * overhangMin);
          capL = Math.max(dimShort, spanZ + 2 * overhangMin);
        } else {
          capW = Math.max(dimShort, spanX + 2 * overhangMin);
          capL = Math.max(dimLong, spanZ + 2 * overhangMin);
        }
      } else {
        // 4-pile square or other
        capW = Math.max(dimLong, spanX + 2 * overhangMin);
        capL = Math.max(dimLong, spanZ + 2 * overhangMin);
      }

      // ══════════════════════════════════════════════════════════
      // 1. CONCRETE BODY & PCC BEDDING
      // ══════════════════════════════════════════════════════════
      const pccH = 0.15; // 150mm thickness
      const pccMat = new THREE.MeshStandardMaterial({
        color: 0x78350f, // dark brown
        roughness: 0.9,
        metalness: 0.0,
        opacity: 0.85,
        transparent: true,
      });

      if (pileCount === 3) {
        // Authentic truncated trapezoidal 3-pile cap matching AutoCAD standard
        const s_mm = Math.max(600, (spanX > 0.1 ? spanX : s_est) * 1000);
        const eo_mm = 300;
        const polyMm = getTruncated3PilePolygonMm(s_mm, eo_mm, 'UP');
        const capShape = new THREE.Shape();
        polyMm.forEach((pt, idx) => {
          if (idx === 0) capShape.moveTo(pt.x / 1000, pt.y / 1000);
          else capShape.lineTo(pt.x / 1000, pt.y / 1000);
        });
        capShape.closePath();

        const concGeom = new THREE.ExtrudeGeometry(capShape, { depth: capD, bevelEnabled: false });
        concGeom.rotateX(-Math.PI / 2);
        concGeom.translate(0, capD / 2, 0);
        const concMesh = new THREE.Mesh(concGeom, concreteMat);
        rootGroup.add(concMesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
        rootGroup.add(edges);

        // Truncated PCC bedding
        const pccPolyMm = getTruncated3PilePolygonMm(s_mm, eo_mm, 'UP', 150);
        const pccShape = new THREE.Shape();
        pccPolyMm.forEach((pt, idx) => {
          if (idx === 0) pccShape.moveTo(pt.x / 1000, pt.y / 1000);
          else pccShape.lineTo(pt.x / 1000, pt.y / 1000);
        });
        pccShape.closePath();
        const pccGeom = new THREE.ExtrudeGeometry(pccShape, { depth: pccH, bevelEnabled: false });
        pccGeom.rotateX(-Math.PI / 2);
        pccGeom.translate(0, -capD / 2, 0);
        const pccMesh = new THREE.Mesh(pccGeom, pccMat);
        rootGroup.add(pccMesh);
      } else {
        // Rectangular pile cap (2-pile, 4-pile, 6-pile)
        const concGeom = new THREE.BoxGeometry(capW, capD, capL);
        const concMesh = new THREE.Mesh(concGeom, concreteMat);
        rootGroup.add(concMesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
        rootGroup.add(edges);

        const pccExtension = 0.15; // 150mm extension beyond cap on all sides
        const pccGeom = new THREE.BoxGeometry(capW + 2 * pccExtension, pccH, capL + 2 * pccExtension);
        const pccMesh = new THREE.Mesh(pccGeom, pccMat);
        pccMesh.position.set(0, -capD / 2 - pccH / 2, 0);
        rootGroup.add(pccMesh);
      }

      const hw = capW / 2 - cover;
      const hl = capL / 2 - cover;
      const yBottom = -capD / 2 + cover;
      const yTop = capD / 2 - cover;
      const jaliHookHeight = Math.max(0.1, (capD - 2 * cover) * 0.75); // ~75% depth vertical legs

      // ── Rebar Materials ──
      // Bottom jali: rich gold/amber main tension rebar (T16)
      const botBarRadius = 0.009; // 18mm display bar
      const botJaliMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0x78350f,
        emissiveIntensity: 0.25,
      });

      // Top jali: cyan/sky-blue distribution & shrinkage rebar (T10/T12)
      const topBarRadius = 0.007; // 14mm display bar
      const topJaliMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0x0e7490,
        emissiveIntensity: 0.25,
      });

      // Face reinforcement (skin rebar): bright emerald / cyan
      const faceBarRadius = 0.006; // 12mm display bar
      const faceBarMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x064e3b,
        emissiveIntensity: 0.2,
      });

      // ══════════════════════════════════════════════════════════
      // 2. BOTTOM JALI (Two-way bottom mesh with 90° UPWARD hooks)
      // ══════════════════════════════════════════════════════════
      const gridCountX = Math.max(4, Math.min(12, Math.round((capL - 2 * cover) / 0.18)));
      const gridCountZ = Math.max(4, Math.min(12, Math.round((capW - 2 * cover) / 0.18)));

      const botHorizGeomX = new THREE.CylinderGeometry(botBarRadius, botBarRadius, capW - 2 * cover, 8);
      botHorizGeomX.rotateZ(Math.PI / 2);
      const botHorizGeomZ = new THREE.CylinderGeometry(botBarRadius, botBarRadius, capL - 2 * cover, 8);
      botHorizGeomZ.rotateX(Math.PI / 2);
      const botVertHookGeom = new THREE.CylinderGeometry(botBarRadius, botBarRadius, jaliHookHeight, 8);

      // Bottom Jali X-direction bars + vertical upward legs at both ends
      for (let i = 0; i < gridCountX; i++) {
        const z = -hl + (2 * hl * i) / Math.max(1, gridCountX - 1);
        const bar = new THREE.Mesh(botHorizGeomX, botJaliMat);
        bar.position.set(0, yBottom, z);
        rootGroup.add(bar);

        const leftHook = new THREE.Mesh(botVertHookGeom, botJaliMat);
        leftHook.position.set(-hw, yBottom + jaliHookHeight / 2, z);
        rootGroup.add(leftHook);

        const rightHook = new THREE.Mesh(botVertHookGeom, botJaliMat);
        rightHook.position.set(hw, yBottom + jaliHookHeight / 2, z);
        rootGroup.add(rightHook);
      }

      // Bottom Jali Z-direction bars + vertical upward legs at both ends
      for (let i = 0; i < gridCountZ; i++) {
        const x = -hw + (2 * hw * i) / Math.max(1, gridCountZ - 1);
        const bar = new THREE.Mesh(botHorizGeomZ, botJaliMat);
        bar.position.set(x, yBottom + 0.018, 0);
        rootGroup.add(bar);

        const backHook = new THREE.Mesh(botVertHookGeom, botJaliMat);
        backHook.position.set(x, yBottom + 0.018 + jaliHookHeight / 2, -hl);
        rootGroup.add(backHook);

        const frontHook = new THREE.Mesh(botVertHookGeom, botJaliMat);
        frontHook.position.set(x, yBottom + 0.018 + jaliHookHeight / 2, hl);
        rootGroup.add(frontHook);
      }

      // ══════════════════════════════════════════════════════════
      // 3. TOP JALI (Two-way top mesh with 90° DOWNWARD hooks)
      // ══════════════════════════════════════════════════════════
      const topCountX = Math.max(3, Math.min(10, Math.round((capL - 2 * cover) / 0.22)));
      const topCountZ = Math.max(3, Math.min(10, Math.round((capW - 2 * cover) / 0.22)));

      const topHorizGeomX = new THREE.CylinderGeometry(topBarRadius, topBarRadius, capW - 2 * cover, 8);
      topHorizGeomX.rotateZ(Math.PI / 2);
      const topHorizGeomZ = new THREE.CylinderGeometry(topBarRadius, topBarRadius, capL - 2 * cover, 8);
      topHorizGeomZ.rotateX(Math.PI / 2);
      const topVertHookGeom = new THREE.CylinderGeometry(topBarRadius, topBarRadius, jaliHookHeight, 8);

      for (let i = 0; i < topCountX; i++) {
        const z = -hl + (2 * hl * i) / Math.max(1, topCountX - 1);
        const bar = new THREE.Mesh(topHorizGeomX, topJaliMat);
        bar.position.set(0, yTop, z);
        rootGroup.add(bar);

        const leftHook = new THREE.Mesh(topVertHookGeom, topJaliMat);
        leftHook.position.set(-hw, yTop - jaliHookHeight / 2, z);
        rootGroup.add(leftHook);

        const rightHook = new THREE.Mesh(topVertHookGeom, topJaliMat);
        rightHook.position.set(hw, yTop - jaliHookHeight / 2, z);
        rootGroup.add(rightHook);
      }

      for (let i = 0; i < topCountZ; i++) {
        const x = -hw + (2 * hw * i) / Math.max(1, topCountZ - 1);
        const bar = new THREE.Mesh(topHorizGeomZ, topJaliMat);
        bar.position.set(x, yTop - 0.016, 0);
        rootGroup.add(bar);

        const backHook = new THREE.Mesh(topVertHookGeom, topJaliMat);
        backHook.position.set(x, yTop - 0.016 - jaliHookHeight / 2, -hl);
        rootGroup.add(backHook);

        const frontHook = new THREE.Mesh(topVertHookGeom, topJaliMat);
        frontHook.position.set(x, yTop - 0.016 - jaliHookHeight / 2, hl);
        rootGroup.add(frontHook);
      }

      // ══════════════════════════════════════════════════════════
      // 4. FACE REINFORCEMENT (Side Face Rebar & Closed Links)
      // ══════════════════════════════════════════════════════════
      const sideFaceLayers = Math.max(2, Math.min(5, Math.round((capD - 2 * cover) / 0.22)));
      const sideBarGeomX = new THREE.CylinderGeometry(faceBarRadius, faceBarRadius, capW - 2 * cover, 8);
      sideBarGeomX.rotateZ(Math.PI / 2);
      const sideBarGeomZ = new THREE.CylinderGeometry(faceBarRadius, faceBarRadius, capL - 2 * cover, 8);
      sideBarGeomZ.rotateX(Math.PI / 2);

      for (let i = 1; i <= sideFaceLayers; i++) {
        const y = yBottom + (i / (sideFaceLayers + 1)) * (yTop - yBottom);

        const frontBar = new THREE.Mesh(sideBarGeomX, faceBarMat);
        frontBar.position.set(0, y, hl);
        rootGroup.add(frontBar);

        const backBar = new THREE.Mesh(sideBarGeomX, faceBarMat);
        backBar.position.set(0, y, -hl);
        rootGroup.add(backBar);

        const leftBar = new THREE.Mesh(sideBarGeomZ, faceBarMat);
        leftBar.position.set(-hw, y, 0);
        rootGroup.add(leftBar);

        const rightBar = new THREE.Mesh(sideBarGeomZ, faceBarMat);
        rightBar.position.set(hw, y, 0);
        rootGroup.add(rightBar);

        const ringPts = [
          new THREE.Vector3(-hw, y, -hl),
          new THREE.Vector3( hw, y, -hl),
          new THREE.Vector3( hw, y,  hl),
          new THREE.Vector3(-hw, y,  hl),
          new THREE.Vector3(-hw, y, -hl),
        ];
        const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
        const ringLine = new THREE.Line(ringGeom, tieLineMat);
        rootGroup.add(ringLine);
      }

      // ══════════════════════════════════════════════════════════
      // 5. COLUMN STARTER DOWELS (Anchored to Bottom Jali with 90° feet)
      // ══════════════════════════════════════════════════════════
      const colBarRadius = 0.011; // 22mm display column starter
      const colFootLen = 0.25; // 250mm anchor foot
      const colDowelHeight = (capD / 2 - cover) + 0.6; // extends 600mm above cap top
      const colDowelGeom = new THREE.CylinderGeometry(colBarRadius, colBarRadius, colDowelHeight, 10);
      const colFootGeomX = new THREE.CylinderGeometry(colBarRadius, colBarRadius, colFootLen, 10);
      colFootGeomX.rotateZ(Math.PI / 2);

      const starterOffsets = [
        { dx: -0.15, dz: -0.15, footDir: -1 },
        { dx:  0.15, dz: -0.15, footDir:  1 },
        { dx:  0.15, dz:  0.15, footDir:  1 },
        { dx: -0.15, dz:  0.15, footDir: -1 },
      ];

      starterOffsets.forEach(({ dx, dz, footDir }) => {
        const dowel = new THREE.Mesh(colDowelGeom, botJaliMat);
        dowel.position.set(dx, yBottom + colDowelHeight / 2, dz);
        rootGroup.add(dowel);

        const foot = new THREE.Mesh(colFootGeomX, botJaliMat);
        foot.position.set(dx + (footDir * colFootLen) / 2, yBottom + 0.01, dz);
        rootGroup.add(foot);
      });

      // Column ties / links above cap top ("LINKS")
      for (let l = 1; l <= 4; l++) {
        const ly = capD / 2 + l * 0.12;
        const linkPts = [
          new THREE.Vector3(-0.16, ly, -0.16),
          new THREE.Vector3( 0.16, ly, -0.16),
          new THREE.Vector3( 0.16, ly,  0.16),
          new THREE.Vector3(-0.16, ly,  0.16),
          new THREE.Vector3(-0.16, ly, -0.16),
        ];
        const linkGeom = new THREE.BufferGeometry().setFromPoints(linkPts);
        const linkLine = new THREE.Line(linkGeom, tieLineMat);
        rootGroup.add(linkLine);
      }

      // ══════════════════════════════════════════════════════════
      // 6. BORED PILES & PROJECTING DOWELS (400Ø PILE)
      // ══════════════════════════════════════════════════════════
      const pileShaftH = 1.2; // visible shaft length hanging below PCC
      const pGeom = new THREE.CylinderGeometry(pRad, pRad, pileShaftH, 24);
      const pMat = new THREE.MeshPhysicalMaterial({
        color: 0x22c55e, // green per IS CAD convention
        transparent: true,
        opacity: 0.45,
        roughness: 0.4,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const pEdgeMat = new THREE.LineBasicMaterial({ color: 0x16a34a, opacity: 1.0, transparent: true });
      const dowelPileMat = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        roughness: 0.3,
        metalness: 0.6,
      });

      const pccYBase = -capD / 2 - pccH;
      const pileYCenter = pccYBase - pileShaftH / 2;

      resolvedOffsets.forEach((po) => {
        // Pile shaft cylinder
        const stub = new THREE.Mesh(pGeom, pMat);
        stub.position.set(po.x, pileYCenter, po.y);
        rootGroup.add(stub);

        // Solid green outline
        const pEdgeGeom = new THREE.EdgesGeometry(pGeom);
        const pEdgeLines = new THREE.LineSegments(pEdgeGeom, pEdgeMat);
        pEdgeLines.position.copy(stub.position);
        rootGroup.add(pEdgeLines);

        // 4 vertical pile dowel bars projecting up through PCC into the cap
        const dowelLen = capD * 0.70 + pccH;
        const dowelPileGeom = new THREE.CylinderGeometry(0.007, 0.007, dowelLen, 8);
        const dowelYCen = pccYBase + dowelLen / 2;
        const dowelPairs = [
          { dx: -pRad * 0.45, dz: 0 },
          { dx:  pRad * 0.45, dz: 0 },
          { dx: 0, dz: -pRad * 0.45 },
          { dx: 0, dz:  pRad * 0.45 },
        ];
        dowelPairs.forEach(({ dx, dz }) => {
          const dw = new THREE.Mesh(dowelPileGeom, dowelPileMat);
          dw.position.set(po.x + dx, dowelYCen, po.y + dz);
          rootGroup.add(dw);
        });
      });

    } else if (elementType === 'PILE') {
      // Bored/Driven Pile Cylinder (diameter b, vertical along Y, length L)
      const pRadius = b / 2;
      const concGeom = new THREE.CylinderGeometry(pRadius, pRadius, L, 24);
      const concMesh = new THREE.Mesh(concGeom, concreteMat);
      rootGroup.add(concMesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
      rootGroup.add(edges);

      // Rebar Cage
      const cageRadius = pRadius - cover;
      const barRadius = (Math.max(12, barDiameter_mm) / 1000) / 2;
      const barGeom = new THREE.CylinderGeometry(barRadius, barRadius, L - 2 * cover, 8);

      const nBars = Math.max(6, barCount);
      for (let i = 0; i < nBars; i++) {
        const angle = (2 * Math.PI * i) / nBars;
        const x = cageRadius * Math.cos(angle);
        const z = cageRadius * Math.sin(angle);
        const bar = new THREE.Mesh(barGeom, rebarMat);
        bar.position.set(x, 0, z);
        rootGroup.add(bar);
      }

      // Helical Spiral Wrapping
      const turns = Math.min(50, Math.floor(L / 0.15));
      const curvePts: THREE.Vector3[] = [];
      const totalAngle = turns * 2 * Math.PI;
      const steps = turns * 16;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const theta = t * totalAngle;
        const y = -L / 2 + cover + t * (L - 2 * cover);
        const x = (cageRadius + 0.005) * Math.cos(theta);
        const z = (cageRadius + 0.005) * Math.sin(theta);
        curvePts.push(new THREE.Vector3(x, y, z));
      }
      const spiralGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
      const spiralLine = new THREE.Line(spiralGeom, tieLineMat);
      rootGroup.add(spiralLine);
    } else {
      // Generic Box / Footing / Slab
      const concGeom = new THREE.BoxGeometry(b, D, L);
      const concMesh = new THREE.Mesh(concGeom, concreteMat);
      rootGroup.add(concMesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(concGeom), edgeMat);
      rootGroup.add(edges);
    }

    // Camera Framing
    const maxDim = Math.max(b, D, L, 0.4);
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.8);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    // Render loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotateRef.current) {
        rootGroup.rotation.y += 0.008;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    let ro: any = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          camera.aspect = entry.contentRect.width / entry.contentRect.height;
          camera.updateProjectionMatrix();
          renderer.setSize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      ro.observe(container);
    }

    return () => {
      cancelAnimationFrame(animId);
      if (ro) ro.disconnect();
      controls.dispose();
      renderer.dispose();
      // Dispose materials & geometries
      rootGroup.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
          else child.material.dispose();
        }
      });
      concreteMat.dispose();
      edgeMat.dispose();
      rebarMat.dispose();
      stirrupMat.dispose();
      tieLineMat.dispose();
    };
  }, [
    elementType,
    width_m,
    depth_m,
    length_m,
    cover_mm,
    barCount,
    barDiameter_mm,
    topBarsCount,
    topBarDiameter_mm,
    botBarsCount,
    botBarDiameter_mm,
    tieSpacing_mm,
    tieDiameter_mm,
    ghostMode,
  ]);

  const handleResetCamera = () => {
    if (!controlsRef.current) return;
    const maxDim = Math.max(width_m, depth_m, length_m, 0.4);
    controlsRef.current.object.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.8);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono select-none">
      {/* Viewport Floating Header Bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        <div className="px-2.5 py-1 bg-slate-900/90 backdrop-blur-md rounded border border-slate-700/80 text-[10px] text-amber-400 font-bold flex items-center gap-1.5 shadow">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>3D REBAR VIEW · {title}</span>
        </div>

        <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded border border-slate-700/80 shadow">
          <button
            onClick={() => setGhostMode(ghostMode === 'XRAY' ? 'SOLID' : ghostMode === 'SOLID' ? 'REBAR_ONLY' : 'XRAY')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              ghostMode === 'XRAY'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : ghostMode === 'SOLID'
                ? 'bg-slate-700 text-white'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
            title="Toggle Ghost X-Ray / Solid / Rebar-Only Mode"
          >
            {ghostMode === 'XRAY' ? 'Ghost X-Ray' : ghostMode === 'SOLID' ? 'Solid Shell' : 'Rebar Only'}
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
              autoRotate ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'
            }`}
            title="Auto-Rotate"
          >
            {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset 3D Angle"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-72 cursor-grab active:cursor-grabbing" />

      {/* Viewport Bottom Hint */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between text-[9px] text-slate-500 pointer-events-none">
        <span>Rotate: Left Click · Zoom: Scroll · Pan: Right Click</span>
        <span className="text-amber-400/80">IS 456 / IS 13920 Concrete + Rebar</span>
      </div>
    </div>
  );
};
