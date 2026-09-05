/**
 * Interactive 2D Parametric BIM Floor Plan Canvas
 * Real-time snapping, wall drawing, door/window hosting, room polygons, dimensions, and structural underlays.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  ArchitecturalStaircase,
  ArchitecturalDimension,
  ActivePlanTool,
  ArchitecturalSettings,
  Point2D,
  SnapResult,
} from '../types/architecturalTypes';
import { CoordinateTransform } from '../utils/coordinateTransform';
import { ArchitecturalGeometryEngine } from '../engines/architecturalGeometryEngine';
import { SnapEngine } from '../engines/snapEngine';
import { WallEngine } from '../engines/wallEngine';
import { DoorEngine } from '../engines/doorEngine';
import { WindowEngine } from '../engines/windowEngine';
import { OpeningEngine } from '../engines/openingEngine';
import { RoomEngine } from '../engines/roomEngine';
import { StaircasePlacementEngine } from '../engines/staircasePlacementEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import { NormalizedStructuralModel } from '@/features/model/types';

interface FloorPlanCanvasProps {
  activeFloorIndex: number;
  floorPlans: FloorPlanLevel[];
  structuralModel: NormalizedStructuralModel | null;
  activeTool: ActivePlanTool;
  selectedId: string | null;
  selectedType: 'WALL' | 'DOOR' | 'WINDOW' | 'OPENING' | 'ROOM' | 'STAIRCASE' | 'DIMENSION' | null;
  walls: Record<string, ArchitecturalWall>;
  doors: Record<string, ArchitecturalDoor>;
  windows: Record<string, ArchitecturalWindow>;
  openings: Record<string, ArchitecturalOpening>;
  rooms: Record<string, ArchitecturalRoom>;
  staircases?: Record<string, ArchitecturalStaircase>;
  dimensions: Record<string, ArchitecturalDimension>;
  settings: ArchitecturalSettings;
  wallThickness: number;
  doorWidth: number;
  windowWidth: number;
  onSelectElement: (id: string | null, type?: any) => void;
  onAddWall: (wall: ArchitecturalWall) => void;
  onUpdateWall: (id: string, updates: Partial<ArchitecturalWall>) => void;
  onAddDoor: (door: ArchitecturalDoor) => void;
  onAddWindow: (win: ArchitecturalWindow) => void;
  onAddOpening: (op: ArchitecturalOpening) => void;
  onAddStaircase?: (staircase: ArchitecturalStaircase) => void;
  onUpdateStaircase?: (id: string, updates: Partial<ArchitecturalStaircase>) => void;
  onAddDimension: (dim: ArchitecturalDimension) => void;
  onAutoDetectRooms: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  activeFloorIndex,
  floorPlans,
  structuralModel,
  activeTool,
  selectedId,
  selectedType,
  walls,
  doors,
  windows,
  openings,
  rooms,
  staircases = {},
  dimensions,
  settings,
  wallThickness,
  doorWidth,
  windowWidth,
  onSelectElement,
  onAddWall,
  onUpdateWall,
  onAddDoor,
  onAddWindow,
  onAddOpening,
  onAddStaircase,
  onUpdateStaircase,
  onAddDimension,
  onAutoDetectRooms,
  onDeleteSelected,
  onUndo,
  onRedo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan & Zoom View State
  const [viewState, setViewState] = useState({
    panX: 400,
    panY: 350,
    zoom: 40, // pixels per meter
  });

  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const isDraggingStaircaseRef = useRef(false);
  const dragStaircaseOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Drawing Interaction State
  const [drawStartPoint, setDrawStartPoint] = useState<Point2D | null>(null);
  const [currentMouseWorld, setCurrentMouseWorld] = useState<Point2D>({ x: 0, y: 0 });
  const [activeSnap, setActiveSnap] = useState<SnapResult | null>(null);
  const [measureStart, setMeasureStart] = useState<Point2D | null>(null);

  const activeFloorId = `floor_${activeFloorIndex}`;
  const currentFloorPlan = floorPlans[activeFloorIndex] || null;

  // Filter elements for current floor
  const floorWalls = Object.values(walls).filter((w) => w.floorId === activeFloorId);
  const floorDoors = Object.values(doors).filter((d) => d.floorId === activeFloorId);
  const floorWindows = Object.values(windows).filter((w) => w.floorId === activeFloorId);
  const floorOpenings = Object.values(openings).filter((o) => o.floorId === activeFloorId);
  const floorRooms = Object.values(rooms).filter((r) => r.floorId === activeFloorId);
  const floorStairs = Object.values(staircases || {}).filter((s) => s.floorId === activeFloorId);
  const floorDimensions = Object.values(dimensions).filter((d) => d.floorId === activeFloorId);

  // Previous floor ghost elements
  const prevFloorId = `floor_${activeFloorIndex - 1}`;
  const prevFloorWalls = Object.values(walls).filter((w) => w.floorId === prevFloorId);

  // Fit View / Center Plan
  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    if (floorWalls.length > 0) {
      const xs = floorWalls.flatMap((wall) => [wall.start.x, wall.end.x]);
      const ys = floorWalls.flatMap((wall) => [wall.start.y, wall.end.y]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const spanX = Math.max(2, maxX - minX);
      const spanY = Math.max(2, maxY - minY);
      const padding = 100;
      const zoomX = (w - padding * 2) / spanX;
      const zoomY = (h - padding * 2) / spanY;
      const zoom = Math.max(15, Math.min(80, Math.min(zoomX, zoomY)));

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setViewState({
        panX: w / 2 - centerX * zoom,
        panY: h / 2 + centerY * zoom, // Canvas Y is inverted
        zoom,
      });
    } else if (structuralModel && structuralModel.boundingBox) {
      const { minX, maxX, minZ, maxZ } = structuralModel.boundingBox;
      const spanX = Math.max(2, maxX - minX);
      const spanZ = Math.max(2, maxZ - minZ);
      const padding = 100;
      const zoom = Math.max(15, Math.min(60, Math.min((w - padding * 2) / spanX, (h - padding * 2) / spanZ)));
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;

      setViewState({
        panX: w / 2 - centerX * zoom,
        panY: h / 2 + centerZ * zoom,
        zoom,
      });
    } else {
      setViewState({
        panX: w / 2,
        panY: h / 2,
        zoom: 35,
      });
    }
  }, [floorWalls, structuralModel]);

  useEffect(() => {
    fitView();
  }, [activeFloorIndex]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const { panX, panY, zoom } = viewState;

    // 1. Background
    ctx.fillStyle = '#0f172a'; // Deep Navy Slate
    ctx.fillRect(0, 0, width, height);

    // 2. Cartesian Grid
    if (settings.gridSettings.enabled) {
      const spacing = settings.gridSettings.spacing || 0.5; // in meters
      const screenSpacing = spacing * zoom;

      if (screenSpacing >= 8) {
        ctx.lineWidth = 1;
        // Minor grid
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();

        const startX = panX % screenSpacing;
        for (let x = startX; x < width; x += screenSpacing) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }

        const startY = panY % screenSpacing;
        for (let y = startY; y < height; y += screenSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Major grid
        const majorInterval = settings.gridSettings.majorInterval || 4;
        const majorScreenSpacing = screenSpacing * majorInterval;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const majorStartX = panX % majorScreenSpacing;
        for (let x = majorStartX; x < width; x += majorScreenSpacing) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }

        const majorStartY = panY % majorScreenSpacing;
        for (let y = majorStartY; y < height; y += majorScreenSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }

      // Origin Axes (0,0)
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      // X-axis (Z in STAAD)
      ctx.moveTo(0, panY);
      ctx.lineTo(width, panY);
      // Y-axis (X in STAAD)
      ctx.moveTo(panX, 0);
      ctx.lineTo(panX, height);
      ctx.stroke();
    }

    // 3. Structural Underlay (Columns & Beams)
    if (settings.showStructuralUnderlay && currentFloorPlan) {
      // Beams
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'; // Sky Blue
      ctx.lineWidth = 2;
      currentFloorPlan.beams.forEach((beam) => {
        const p1 = CoordinateTransform.world2DToScreen({ x: beam.startX, y: beam.startZ }, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen({ x: beam.endX, y: beam.endZ }, panX, panY, zoom);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Columns
      currentFloorPlan.columns.forEach((col) => {
        const center = CoordinateTransform.world2DToScreen({ x: col.x, y: col.z }, panX, panY, zoom);
        const colW = (col.width || 0.45) * zoom;
        const colD = (col.depth || 0.3) * zoom;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)'; // Emerald
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;

        ctx.fillRect(center.x - colW / 2, center.y - colD / 2, colW, colD);
        ctx.strokeRect(center.x - colW / 2, center.y - colD / 2, colW, colD);

        // Column Label
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(col.label || 'COL', center.x, center.y);
      });
    }

    // 4. Previous Floor Ghost Underlay
    if (settings.showPreviousFloorUnderlay && prevFloorWalls.length > 0) {
      ctx.strokeStyle = `rgba(245, 158, 11, ${settings.previousFloorOpacity || 0.35})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      prevFloorWalls.forEach((w) => {
        const p1 = CoordinateTransform.world2DToScreen(w.start, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen(w.end, panX, panY, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      ctx.setLineDash([]);
    }

    // 5. Room Polygons & Badges
    if (settings.showRoomLabels) {
      floorRooms.forEach((room) => {
        if (room.boundary.length >= 3) {
          const isSelected = selectedId === room.id;
          const screenPts = room.boundary.map((pt) => CoordinateTransform.world2DToScreen(pt, panX, panY, zoom));

          // Translucent Fill
          ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(14, 165, 233, 0.12)';
          ctx.strokeStyle = isSelected ? '#f59e0b' : '#0284c7';
          ctx.lineWidth = isSelected ? 2 : 1;

          ctx.beginPath();
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Room Badge Centroid
          const labelPos = room.labelPosition || ArchitecturalGeometryEngine.polygonCentroid(room.boundary);
          const screenLabel = CoordinateTransform.world2DToScreen(labelPos, panX, panY, zoom);

          ctx.fillStyle = isSelected ? '#78350f' : '#1e293b';
          ctx.strokeStyle = isSelected ? '#f59e0b' : '#38bdf8';
          ctx.lineWidth = 1.5;

          const badgeW = 90;
          const badgeH = 34;
          const bx = screenLabel.x - badgeW / 2;
          const by = screenLabel.y - badgeH / 2;

          ctx.beginPath();
          ctx.roundRect(bx, by, badgeW, badgeH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(room.name, screenLabel.x, screenLabel.y - 6);

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${room.area.toFixed(1)} m²`, screenLabel.x, screenLabel.y + 7);
        }
      });
    }

    // 6. Architectural BIM Walls
    floorWalls.forEach((wall) => {
      const isSelected = selectedId === wall.id;
      const outline = WallEngine.getWallOutline(wall);
      const screenOutline = outline.map((pt) => CoordinateTransform.world2DToScreen(pt, panX, panY, zoom));

      if (screenOutline.length >= 4) {
        // Wall Body Fill
        ctx.fillStyle = isSelected
          ? '#d97706' // Selected Amber
          : wall.wallType === 'INTERNAL'
          ? '#94a3b8' // Light Slate for 115mm Internal Partition
          : '#64748b'; // Darker Slate for 230mm External Masonry

        ctx.strokeStyle = isSelected ? '#fde047' : '#334155';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;

        ctx.beginPath();
        ctx.moveTo(screenOutline[0].x, screenOutline[0].y);
        for (let i = 1; i < screenOutline.length; i++) {
          ctx.lineTo(screenOutline[i].x, screenOutline[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wall Centerline & Endpoints
        const p1 = CoordinateTransform.world2DToScreen(wall.start, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen(wall.end, panX, panY, zoom);

        ctx.strokeStyle = isSelected ? '#fde047' : '#475569';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isSelected) {
          // Endpoint Grip Handles
          [p1, p2].forEach((p) => {
            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
            ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
          });
        }
      }
    });

    // 7. Hosted Openings / Doors / Windows Cutouts
    floorDoors.forEach((door) => {
      const host = walls[door.hostWallId];
      if (!host) return;

      const isSelected = selectedId === door.id;
      const center = DoorEngine.getDoorCenter(host, door);
      const screenCenter = CoordinateTransform.world2DToScreen(center, panX, panY, zoom);
      const wallAngle = ArchitecturalGeometryEngine.angle(host.start, host.end);

      ctx.save();
      ctx.translate(screenCenter.x, screenCenter.y);
      // Canvas Y is inverted
      ctx.rotate(-wallAngle);

      const screenW = door.width * zoom;
      const screenThk = host.thickness * zoom;

      // Cutout in wall
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-screenW / 2, -screenThk / 2, screenW, screenThk);

      // Frame Posts
      ctx.fillStyle = isSelected ? '#f59e0b' : '#b45309';
      ctx.fillRect(-screenW / 2, -screenThk / 2, 4, screenThk);
      ctx.fillRect(screenW / 2 - 4, -screenThk / 2, 4, screenThk);

      // Door Leaf line & Swing Arc
      const swingSign = door.swingDirection === 'LEFT' ? -1 : 1;
      const leafStartX = -screenW / 2;
      const leafLen = screenW;

      ctx.strokeStyle = isSelected ? '#f59e0b' : '#d97706';
      ctx.lineWidth = 1.8;

      // Leaf line
      ctx.beginPath();
      ctx.moveTo(leafStartX, 0);
      ctx.lineTo(leafStartX, swingSign * leafLen);
      ctx.stroke();

      // Swing Arc (90 deg)
      ctx.strokeStyle = isSelected ? '#fde047' : '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (swingSign === -1) {
        ctx.arc(leafStartX, 0, leafLen, -Math.PI / 2, 0);
      } else {
        ctx.arc(leafStartX, 0, leafLen, 0, Math.PI / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Door Label
      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(door.id, 0, swingSign * (screenThk / 2 + 10));

      ctx.restore();
    });

    floorWindows.forEach((win) => {
      const host = walls[win.hostWallId];
      if (!host) return;

      const isSelected = selectedId === win.id;
      const center = WindowEngine.getWindowCenter(host, win);
      const screenCenter = CoordinateTransform.world2DToScreen(center, panX, panY, zoom);
      const wallAngle = ArchitecturalGeometryEngine.angle(host.start, host.end);

      ctx.save();
      ctx.translate(screenCenter.x, screenCenter.y);
      ctx.rotate(-wallAngle);

      const screenW = win.width * zoom;
      const screenThk = host.thickness * zoom;

      // Cutout fill
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-screenW / 2, -screenThk / 2, screenW, screenThk);

      // Window Frame & Double Glass lines
      ctx.strokeStyle = isSelected ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 1.5;

      // Outer frame edges
      ctx.strokeRect(-screenW / 2, -screenThk / 2, screenW, screenThk);

      // Double glass lines
      ctx.beginPath();
      ctx.moveTo(-screenW / 2, -2);
      ctx.lineTo(screenW / 2, -2);
      ctx.moveTo(-screenW / 2, 2);
      ctx.lineTo(screenW / 2, 2);
      ctx.stroke();

      // Window Mark Tag
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(win.id, 0, -screenThk / 2 - 6);

      ctx.restore();
    });

    floorOpenings.forEach((op) => {
      const host = walls[op.hostWallId];
      if (!host) return;

      const isSelected = selectedId === op.id;
      const center = OpeningEngine.getOpeningCenter(host, op);
      const screenCenter = CoordinateTransform.world2DToScreen(center, panX, panY, zoom);
      const wallAngle = ArchitecturalGeometryEngine.angle(host.start, host.end);

      ctx.save();
      ctx.translate(screenCenter.x, screenCenter.y);
      ctx.rotate(-wallAngle);

      const screenW = op.width * zoom;
      const screenThk = host.thickness * zoom;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-screenW / 2, -screenThk / 2, screenW, screenThk);

      ctx.strokeStyle = isSelected ? '#f59e0b' : '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-screenW / 2, -screenThk / 2, screenW, screenThk);
      ctx.setLineDash([]);

      ctx.restore();
    });

    // 7.5. Architectural RCC Staircases (Parametric Plan Detail)
    floorStairs.forEach((stair) => {
      const isSelected = selectedId === stair.id;
      const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);

      // A. Outer Enclosure Walls
      if (stair.hasEnclosureWalls && comp.enclosurePolygon.length > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = isSelected ? '#f59e0b' : '#475569';
        ctx.lineWidth = isSelected ? 2 : 1.5;

        ctx.beginPath();
        const startP = CoordinateTransform.world2DToScreen(comp.enclosurePolygon[0], panX, panY, zoom);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < comp.enclosurePolygon.length; i++) {
          const pt = CoordinateTransform.world2DToScreen(comp.enclosurePolygon[i], panX, panY, zoom);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // B. Landings (Floor Landing + Mid-Landing)
      const drawPoly = (poly: Point2D[], fill: string, stroke: string) => {
        if (poly.length === 0) return;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const p0 = CoordinateTransform.world2DToScreen(poly[0], panX, panY, zoom);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < poly.length; i++) {
          const pt = CoordinateTransform.world2DToScreen(poly[i], panX, panY, zoom);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      drawPoly(comp.floorLandingPolygon, 'rgba(30, 27, 75, 0.45)', '#6366f1');
      drawPoly(comp.midLandingPolygon, 'rgba(6, 78, 59, 0.45)', '#10b981');
      drawPoly(comp.flight1Polygon, 'rgba(12, 74, 110, 0.35)', '#0284c7');
      drawPoly(comp.flight2Polygon, 'rgba(12, 74, 110, 0.35)', '#0284c7');

      // Central Well Gap
      if (comp.wellGapPolygon.length > 0) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        drawPoly(comp.wellGapPolygon, 'rgba(15, 23, 42, 0.7)', '#64748b');
        ctx.setLineDash([]);
      }

      // C. Flight 1 & Flight 2 Tread Lines & Numbering
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      comp.flight1TreadLines.forEach((t) => {
        const p1 = CoordinateTransform.world2DToScreen(t.start, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen(t.end, panX, panY, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        if (zoom >= 25 && t.index % 2 === 1) {
          ctx.fillStyle = '#7dd3fc';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.fillText(`${t.index}`, midX, midY);
        }
      });

      comp.flight2TreadLines.forEach((t) => {
        const p1 = CoordinateTransform.world2DToScreen(t.start, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen(t.end, panX, panY, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        if (zoom >= 25 && t.index % 2 === 1) {
          ctx.fillStyle = '#7dd3fc';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.fillText(`${t.index}`, midX, midY);
        }
      });

      // D. Direction Arrows ("UP")
      const drawDirectionArrow = (start: Point2D, end: Point2D, label: string) => {
        const s = CoordinateTransform.world2DToScreen(start, panX, panY, zoom);
        const e = CoordinateTransform.world2DToScreen(end, panX, panY, zoom);

        ctx.strokeStyle = '#34d399';
        ctx.fillStyle = '#34d399';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(e.y - s.y, e.x - s.x);
        const headLen = 7;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x - headLen * Math.cos(angle - Math.PI / 6),
          e.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          e.x - headLen * Math.cos(angle + Math.PI / 6),
          e.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        if (zoom >= 22) {
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, (s.x + e.x) / 2, (s.y + e.y) / 2 - 4);
        }
      };

      drawDirectionArrow(comp.flight1Arrow.start, comp.flight1Arrow.end, 'UP');
      drawDirectionArrow(comp.flight2Arrow.start, comp.flight2Arrow.end, 'UP');

      // E. Landing Elevation Labels
      if (zoom >= 25 && comp.floorLandingPolygon.length > 0 && comp.midLandingPolygon.length > 0) {
        const f0 = CoordinateTransform.world2DToScreen(comp.floorLandingPolygon[0], panX, panY, zoom);
        const f2 = CoordinateTransform.world2DToScreen(comp.floorLandingPolygon[2], panX, panY, zoom);
        const m0 = CoordinateTransform.world2DToScreen(comp.midLandingPolygon[0], panX, panY, zoom);
        const m2 = CoordinateTransform.world2DToScreen(comp.midLandingPolygon[2], panX, panY, zoom);

        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`EL. +${stair.startElevation.toFixed(2)}m`, (f0.x + f2.x) / 2, (f0.y + f2.y) / 2);

        const midEl = stair.startElevation + (stair.endElevation - stair.startElevation) / 2;
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(`MID +${midEl.toFixed(2)}m`, (m0.x + m2.x) / 2, (m0.y + m2.y) / 2);
      }

      // F. Dual-Side Landing Doors
      const drawStairDoor = (door: any, color: string) => {
        if (!door) return;
        const opStart = CoordinateTransform.world2DToScreen(door.opening.start, panX, panY, zoom);
        const opEnd = CoordinateTransform.world2DToScreen(door.opening.end, panX, panY, zoom);
        const leafEnd = CoordinateTransform.world2DToScreen(door.leaf.end, panX, panY, zoom);

        // Opening Line
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(opStart.x, opStart.y);
        ctx.lineTo(opEnd.x, opEnd.y);
        ctx.stroke();

        // Door Leaf
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(opStart.x, opStart.y);
        ctx.lineTo(leafEnd.x, leafEnd.y);
        ctx.stroke();

        // Swing Arc
        const rScreen = door.radius * zoom;
        ctx.strokeStyle = isSelected ? '#fde047' : color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(opStart.x, opStart.y, rScreen, 0, Math.PI / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      if (comp.leftDoor) drawStairDoor(comp.leftDoor, '#f59e0b');
      if (comp.rightDoor) drawStairDoor(comp.rightDoor, '#f59e0b');
      if (comp.frontDoor) drawStairDoor(comp.frontDoor, '#38bdf8');

      // G. Selection Box & Title Tag
      if (isSelected) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        const bMin = CoordinateTransform.world2DToScreen(
          { x: comp.bounds.minX - 0.1, y: comp.bounds.maxY + 0.1 },
          panX,
          panY,
          zoom
        );
        const bMax = CoordinateTransform.world2DToScreen(
          { x: comp.bounds.maxX + 0.1, y: comp.bounds.minY - 0.1 },
          panX,
          panY,
          zoom
        );

        ctx.strokeRect(bMin.x, bMin.y, bMax.x - bMin.x, bMax.y - bMin.y);
        ctx.setLineDash([]);

        // Handle Grips
        [
          { x: bMin.x, y: bMin.y },
          { x: bMax.x, y: bMin.y },
          { x: bMax.x, y: bMax.y },
          { x: bMin.x, y: bMax.y },
        ].forEach((h) => {
          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
          ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
        });

        // Tag
        const tagText = `${stair.name} (${stair.roomLength}m × ${stair.roomWidth}m, rot: ${stair.rotation || 0}°)`;
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bMin.x, bMin.y - 20, tagText.length * 6.5 + 14, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, bMin.x + 7, bMin.y - 11);
      }
    });

    // 8. Dimensions
    if (settings.showDimensions) {
      floorDimensions.forEach((dim) => {
        const p1 = CoordinateTransform.world2DToScreen(dim.start, panX, panY, zoom);
        const p2 = CoordinateTransform.world2DToScreen(dim.end, panX, panY, zoom);
        const dist = ArchitecturalGeometryEngine.distance(dim.start, dim.end);

        ctx.strokeStyle = '#94a3b8';
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // End ticks
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const tickLen = 6;
        [p1, p2].forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(
            p.x - Math.sin(angle) * tickLen - Math.cos(angle) * tickLen,
            p.y + Math.cos(angle) * tickLen - Math.sin(angle) * tickLen
          );
          ctx.lineTo(
            p.x + Math.sin(angle) * tickLen + Math.cos(angle) * tickLen,
            p.y - Math.cos(angle) * tickLen + Math.sin(angle) * tickLen
          );
          ctx.stroke();
        });

        // Text Badge
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${Math.round(dist * 1000)} mm`, midX, midY - 3);
      });
    }

    // 9. Active Rubberband Drawing Previews
    if (activeTool === 'WALL' && drawStartPoint) {
      const p1 = CoordinateTransform.world2DToScreen(drawStartPoint, panX, panY, zoom);
      const targetPoint = activeSnap ? activeSnap.point : currentMouseWorld;
      const p2 = CoordinateTransform.world2DToScreen(targetPoint, panX, panY, zoom);

      // Temporary wall outline preview
      const tempWall = WallEngine.createWall(
        drawStartPoint,
        targetPoint,
        activeFloorId,
        [],
        wallThickness,
        3.2,
        wallThickness > 0.15 ? 'EXTERNAL' : 'INTERNAL'
      );
      const outline = WallEngine.getWallOutline(tempWall);
      const screenOutline = outline.map((pt) => CoordinateTransform.world2DToScreen(pt, panX, panY, zoom));

      if (screenOutline.length >= 4) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald translucent
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(screenOutline[0].x, screenOutline[0].y);
        for (let i = 1; i < screenOutline.length; i++) {
          ctx.lineTo(screenOutline[i].x, screenOutline[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Live Length & Angle HUD Badge
      const dist = ArchitecturalGeometryEngine.distance(drawStartPoint, targetPoint);
      const angDeg = ArchitecturalGeometryEngine.angleDegrees(drawStartPoint, targetPoint);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - 55, midY - 24, 110, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${dist.toFixed(2)}m • ${angDeg.toFixed(0)}°`, midX, midY - 14);
    }

    if (activeTool === 'DOOR' && activeSnap && activeSnap.targetElementId) {
      const hostWall = walls[activeSnap.targetElementId];
      if (hostWall) {
        const previewDoor = DoorEngine.createDoor(
          hostWall,
          activeSnap.point,
          activeFloorId,
          [],
          doorWidth
        );
        const center = DoorEngine.getDoorCenter(hostWall, previewDoor);
        const screenCenter = CoordinateTransform.world2DToScreen(center, panX, panY, zoom);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(screenCenter.x, screenCenter.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (activeTool === 'WINDOW' && activeSnap && activeSnap.targetElementId) {
      const hostWall = walls[activeSnap.targetElementId];
      if (hostWall) {
        const previewWin = WindowEngine.createWindow(
          hostWall,
          activeSnap.point,
          activeFloorId,
          [],
          windowWidth
        );
        const center = WindowEngine.getWindowCenter(hostWall, previewWin);
        const screenCenter = CoordinateTransform.world2DToScreen(center, panX, panY, zoom);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(screenCenter.x, screenCenter.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (activeTool === 'MEASURE' && measureStart) {
      const p1 = CoordinateTransform.world2DToScreen(measureStart, panX, panY, zoom);
      const targetPoint = activeSnap ? activeSnap.point : currentMouseWorld;
      const p2 = CoordinateTransform.world2DToScreen(targetPoint, panX, panY, zoom);
      const dist = ArchitecturalGeometryEngine.distance(measureStart, targetPoint);

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = '#881337';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - 40, midY - 20, 80, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${dist.toFixed(2)} m`, midX, midY - 10);
    }

    // 10. Snap Markers & Magnetic Indicator Crosshairs
    if (activeSnap) {
      const screenSnap = CoordinateTransform.world2DToScreen(activeSnap.point, panX, panY, zoom);

      ctx.strokeStyle = '#06b6d4'; // Cyan
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenSnap.x, screenSnap.y, 7, 0, 2 * Math.PI);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(screenSnap.x - 10, screenSnap.y);
      ctx.lineTo(screenSnap.x + 10, screenSnap.y);
      ctx.moveTo(screenSnap.x, screenSnap.y - 10);
      ctx.lineTo(screenSnap.x, screenSnap.y + 10);
      ctx.stroke();

      // Snap Description Tag
      if (activeSnap.description) {
        ctx.fillStyle = '#083344';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(screenSnap.x + 12, screenSnap.y - 18, activeSnap.description.length * 7 + 10, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSnap.description, screenSnap.x + 17, screenSnap.y - 9);
      }
    }
  }, [
    viewState,
    floorWalls,
    floorDoors,
    floorWindows,
    floorOpenings,
    floorRooms,
    floorDimensions,
    prevFloorWalls,
    currentFloorPlan,
    activeTool,
    selectedId,
    drawStartPoint,
    currentMouseWorld,
    activeSnap,
    measureStart,
    settings,
    wallThickness,
    doorWidth,
    windowWidth,
  ]);

  // Mouse & Pointer Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Middle click or Alt+click for pan
    if (e.button === 1 || e.altKey || e.shiftKey && e.button === 0 && activeTool === 'SELECT') {
      isPanningRef.current = true;
      lastMousePosRef.current = { x: mouseX, y: mouseY };
      return;
    }

    if (e.button !== 0) return;

    const mouseWorld = CoordinateTransform.screenToWorld2D(
      { x: mouseX, y: mouseY },
      viewState.panX,
      viewState.panY,
      viewState.zoom
    );
    const clickPoint = activeSnap ? activeSnap.point : mouseWorld;

    if (activeTool === 'WALL') {
      if (!drawStartPoint) {
        setDrawStartPoint(clickPoint);
      } else {
        // Finish drawing wall
        if (ArchitecturalGeometryEngine.distance(drawStartPoint, clickPoint) > 0.1) {
          const newWall = WallEngine.createWall(
            drawStartPoint,
            clickPoint,
            activeFloorId,
            Object.keys(walls),
            wallThickness,
            3.2,
            wallThickness > 0.15 ? 'EXTERNAL' : 'INTERNAL'
          );
          onAddWall(newWall);
          setDrawStartPoint(clickPoint); // chain drawing
        }
      }
    } else if (activeTool === 'DOOR') {
      // Must click on a host wall
      const hostWall = activeSnap?.targetElementId
        ? walls[activeSnap.targetElementId]
        : floorWalls.find((w) => {
            const proj = ArchitecturalGeometryEngine.projectPointOnSegment(clickPoint, w.start, w.end);
            return proj.distance < w.thickness;
          });

      if (hostWall) {
        const newDoor = DoorEngine.createDoor(
          hostWall,
          clickPoint,
          activeFloorId,
          Object.keys(doors),
          doorWidth
        );
        onAddDoor(newDoor);
      }
    } else if (activeTool === 'WINDOW') {
      const hostWall = activeSnap?.targetElementId
        ? walls[activeSnap.targetElementId]
        : floorWalls.find((w) => {
            const proj = ArchitecturalGeometryEngine.projectPointOnSegment(clickPoint, w.start, w.end);
            return proj.distance < w.thickness;
          });

      if (hostWall) {
        const newWin = WindowEngine.createWindow(
          hostWall,
          clickPoint,
          activeFloorId,
          Object.keys(windows),
          windowWidth
        );
        onAddWindow(newWin);
      }
    } else if (activeTool === 'OPENING') {
      const hostWall = activeSnap?.targetElementId
        ? walls[activeSnap.targetElementId]
        : floorWalls.find((w) => {
            const proj = ArchitecturalGeometryEngine.projectPointOnSegment(clickPoint, w.start, w.end);
            return proj.distance < w.thickness;
          });

      if (hostWall) {
        const newOp = OpeningEngine.createOpening(
          hostWall,
          clickPoint,
          activeFloorId,
          Object.keys(openings),
          1.0
        );
        onAddOpening(newOp);
      }
    } else if (activeTool === 'DIMENSION') {
      if (!drawStartPoint) {
        setDrawStartPoint(clickPoint);
      } else {
        const newDim: ArchitecturalDimension = {
          id: ArchitecturalIdGenerator.generateDimensionId(Object.keys(dimensions)),
          floorId: activeFloorId,
          start: drawStartPoint,
          end: clickPoint,
          offset: 0.5,
          text: `${Math.round(ArchitecturalGeometryEngine.distance(drawStartPoint, clickPoint) * 1000)} mm`,
        };
        onAddDimension(newDim);
        setDrawStartPoint(null);
      }
    } else if (activeTool === 'MEASURE') {
      if (!measureStart) {
        setMeasureStart(clickPoint);
      } else {
        setMeasureStart(null);
      }
    } else if (activeTool === 'STAIRCASE') {
      const newStair = StaircasePlacementEngine.createDefaultStaircase(
        activeFloorId,
        clickPoint,
        {
          name: `RCC Staircase ${floorStairs.length + 1}`,
        }
      );
      if (onAddStaircase) onAddStaircase(newStair);
      onSelectElement(newStair.id, 'STAIRCASE');
    } else if (activeTool === 'SPLIT' || activeTool === 'SPLIT_WALL') {
      const hostWall = floorWalls.find((w) => {
        const proj = ArchitecturalGeometryEngine.projectPointOnSegment(clickPoint, w.start, w.end);
        return proj.distance < 0.25;
      });

      if (hostWall) {
        const splitResult = WallEngine.splitWall(hostWall, clickPoint, Object.keys(walls));
        if (splitResult) {
          onUpdateWall(hostWall.id, splitResult.wall1);
          onAddWall(splitResult.wall2);
        }
      }
    } else if (activeTool === 'SELECT') {
      // Hit testing: Staircases -> Doors -> Windows -> Rooms -> Walls
      let clickedElementId: string | null = null;
      let clickedElementType: any = null;

      // Staircases (first priority for direct click & drag)
      for (const st of floorStairs) {
        if (StaircasePlacementEngine.isPointInStaircase(clickPoint, st)) {
          clickedElementId = st.id;
          clickedElementType = 'STAIRCASE';
          isDraggingStaircaseRef.current = true;
          dragStaircaseOffsetRef.current = {
            offsetX: clickPoint.x - st.position.x,
            offsetY: clickPoint.y - st.position.y,
          };
          break;
        }
      }

      // Doors
      if (!clickedElementId) {
        for (const d of floorDoors) {
          const host = walls[d.hostWallId];
          if (host) {
            const c = DoorEngine.getDoorCenter(host, d);
            if (ArchitecturalGeometryEngine.distance(clickPoint, c) < d.width / 2 + 0.1) {
              clickedElementId = d.id;
              clickedElementType = 'DOOR';
              break;
            }
          }
        }
      }

      // Windows
      if (!clickedElementId) {
        for (const w of floorWindows) {
          const host = walls[w.hostWallId];
          if (host) {
            const c = WindowEngine.getWindowCenter(host, w);
            if (ArchitecturalGeometryEngine.distance(clickPoint, c) < w.width / 2 + 0.1) {
              clickedElementId = w.id;
              clickedElementType = 'WINDOW';
              break;
            }
          }
        }
      }

      // Rooms
      if (!clickedElementId) {
        for (const r of floorRooms) {
          if (ArchitecturalGeometryEngine.isPointInPolygon(clickPoint, r.boundary)) {
            clickedElementId = r.id;
            clickedElementType = 'ROOM';
            break;
          }
        }
      }

      // Walls
      if (!clickedElementId) {
        for (const w of floorWalls) {
          const proj = ArchitecturalGeometryEngine.projectPointOnSegment(clickPoint, w.start, w.end);
          if (proj.distance < Math.max(0.2, w.thickness / 2 + 0.05)) {
            clickedElementId = w.id;
            clickedElementType = 'WALL';
            break;
          }
        }
      }

      onSelectElement(clickedElementId, clickedElementType);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanningRef.current) {
      const dx = mouseX - lastMousePosRef.current.x;
      const dy = mouseY - lastMousePosRef.current.y;
      setViewState((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
      lastMousePosRef.current = { x: mouseX, y: mouseY };
      return;
    }

    const mouseWorld = CoordinateTransform.screenToWorld2D(
      { x: mouseX, y: mouseY },
      viewState.panX,
      viewState.panY,
      viewState.zoom
    );
    setCurrentMouseWorld(mouseWorld);

    // Dragging Staircase Position
    if (
      isDraggingStaircaseRef.current &&
      selectedId &&
      staircases[selectedId] &&
      onUpdateStaircase
    ) {
      const st = staircases[selectedId];
      const offset = dragStaircaseOffsetRef.current || { offsetX: 0, offsetY: 0 };
      const targetPoint = activeSnap ? activeSnap.point : mouseWorld;
      const newX = Math.round((targetPoint.x - offset.offsetX) * 100) / 100;
      const newY = Math.round((targetPoint.y - offset.offsetY) * 100) / 100;
      if (newX !== st.position.x || newY !== st.position.y) {
        onUpdateStaircase(selectedId, {
          position: { x: newX, y: newY },
        });
      }
      return;
    }

    // Calculate Snapping
    const snap = SnapEngine.findBestSnapPoint(
      mouseWorld,
      floorWalls,
      currentFloorPlan,
      settings.snapSettings,
      settings.gridSettings
    );
    setActiveSnap(snap);
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    isDraggingStaircaseRef.current = false;
    dragStaircaseOffsetRef.current = null;
  };

  // Non-passive wheel event listener to eliminate "Unable to preventDefault inside passive event listener invocation"
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

      setViewState((prev) => {
        const newZoom = Math.max(8, Math.min(250, prev.zoom * zoomFactor));
        const newPanX = mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom);
        const newPanY = mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom);
        return {
          panX: newPanX,
          panY: newPanY,
          zoom: newZoom,
        };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Keyboard Shortcuts & Arrow Key Nudge Moving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling if manipulating canvas elements
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.key) &&
        (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT')
      ) {
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        setDrawStartPoint(null);
        setMeasureStart(null);
        onSelectElement(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT')) {
          onDeleteSelected();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
      } else if (
        selectedId &&
        staircases[selectedId] &&
        onUpdateStaircase &&
        (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT')
      ) {
        const stair = staircases[selectedId];
        const delta = e.shiftKey ? 0.5 : 0.1;

        if (e.key === 'ArrowLeft') {
          onUpdateStaircase(selectedId, {
            position: { x: Math.round((stair.position.x - delta) * 100) / 100, y: stair.position.y },
          });
        } else if (e.key === 'ArrowRight') {
          onUpdateStaircase(selectedId, {
            position: { x: Math.round((stair.position.x + delta) * 100) / 100, y: stair.position.y },
          });
        } else if (e.key === 'ArrowUp') {
          onUpdateStaircase(selectedId, {
            position: { x: stair.position.x, y: Math.round((stair.position.y - delta) * 100) / 100 },
          });
        } else if (e.key === 'ArrowDown') {
          onUpdateStaircase(selectedId, {
            position: { x: stair.position.x, y: Math.round((stair.position.y + delta) * 100) / 100 },
          });
        } else if (e.key.toLowerCase() === 'r') {
          onUpdateStaircase(selectedId, {
            rotation: ((stair.rotation || 0) + 90) % 360,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, staircases, onUpdateStaircase, onDeleteSelected, onUndo, onRedo]);

  return (
    <div ref={containerRef} className="flex-1 h-full w-full relative overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Coordinate & Tool Status Indicator (Bottom Left) */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-lg text-[11px] font-mono text-slate-300 shadow-lg flex items-center gap-3">
        <span className="text-emerald-400 font-bold uppercase">{activeTool} MODE</span>
        <span>
          Cursor: {currentMouseWorld.x.toFixed(2)}m, {currentMouseWorld.y.toFixed(2)}m
        </span>
        <span>Zoom: {Math.round(viewState.zoom)} px/m</span>
      </div>
    </div>
  );
};
