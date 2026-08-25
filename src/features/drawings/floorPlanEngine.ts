import { NormalizedStructuralModel, Member3D, Node3D, Support3D, Plate3D } from '@/features/model/types';
import { ColumnNumberingService, ColumnSupportInfo, ColumnMemberMappingInfo } from '@/features/model/columnNumbering';
import { GradeBeamDesignEngine, GradeBeamDesignOutput } from '@/features/design/gradebeam/gradeBeamEngine';
import { PileCapDesignEngine, PileCapDesignOutput } from '@/features/design/pilecap/pileCapDesignEngine';
import { PileDesignEngine, ProjectPileType } from '@/features/design/pile/pileDesignEngine';
import { CombinedPileCapEngine, CombinedPileCapGroup } from '@/features/design/pilecap/combinedPileCapEngine';

export interface GridLineInfo {
  id: string; // e.g. "1", "2", "3" or "A", "B", "C"
  axis: 'X' | 'Z';
  coord: number; // in meters
  label: string;
}

export interface FloorBeamInfo {
  memberId: number;
  label: string; // e.g. "B1", "B2" or "M12"
  startNodeId: number;
  endNodeId: number;
  startX: number; // meters
  startZ: number; // meters
  endX: number; // meters
  endZ: number; // meters
  length: number; // meters
  width: number; // meters (zd)
  depth: number; // meters (yd)
  sectionName: string;
}

export interface FloorColumnInfo {
  memberId?: number;
  columnSlNo: number;
  label: string; // e.g. "C1", "C2"
  nodeId: number;
  x: number; // meters
  z: number; // meters
  width: number; // meters
  depth: number; // meters
  sectionName: string;
  isGroundSupport: boolean;
  pileCap?: PileCapDesignOutput;
}

export interface FloorGradeBeamInfo {
  gradeBeamId: string;
  startColumnLabel: string;
  endColumnLabel: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  length: number;
  width: number; // mm
  depth: number; // mm
}

export interface FloorSlabPanelInfo {
  id: number;
  label: string; // e.g. "S1", "S2"
  points: { x: number; z: number }[];
  thickness: number; // mm
  areaM2: number;
}

export interface FloorPlanLevel {
  levelIndex: number; // 0 for Foundation, 1 for 1st Floor, etc.
  levelName: string; // e.g. "FOUNDATION & PILE CAPS LAYOUT PLAN", "1ST FLOOR FRAMING PLAN"
  sheetNumber: string; // e.g. "STR-100", "STR-101"
  elevationY: number; // in meters (e.g. 0.00, 3.50, 7.00)
  isFoundationLevel: boolean;
  beams: FloorBeamInfo[];
  columns: FloorColumnInfo[];
  gradeBeams: FloorGradeBeamInfo[];
  slabs: FloorSlabPanelInfo[];
  gridLinesX: GridLineInfo[]; // X grid lines (vertical lines in plan)
  gridLinesZ: GridLineInfo[]; // Z grid lines (horizontal lines in plan)
  combinedPileCaps: CombinedPileCapGroup[]; // Shear wall & merged column combined caps
  absorbedCombinedCapNodeIds: Set<number>;  // nodeIds whose individual caps are superseded
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    height: number;
  };
  metrics: {
    totalBeams: number;
    totalColumns: number;
    totalSlabs: number;
    totalConcreteM3: number;
    totalSteelKg: number;
    totalFloorAreaM2: number;
  };
}

export class FloorPlanEngine {
  /**
   * Discovers and extracts all floor framing plans from foundation to top roof level.
   */
  public static extractAllFloorPlans(
    model: NormalizedStructuralModel | null,
    projectPileTypes?: ProjectPileType[],
    supportPileAssignments?: Record<number, string>,
    customPileCapOverrides?: Record<number, any>,
    manualMergedPileCapGroups?: number[][],
    detachedCombinedCapNodeIds?: number[]
  ): FloorPlanLevel[] {
    if (!model || !model.nodes || !model.members) return [];

    const nodes = model.nodes;
    const members = model.members;
    const supports = model.supports || new Map();
    const columnSupportMapping = ColumnNumberingService.getColumnSupportMapping(model);
    const columnMemberMapping = ColumnNumberingService.getColumnMemberMapping(model);

    // 1. Identify all unique Y elevations in the model
    const yCoordinates: number[] = [];
    for (const node of nodes.values()) {
      const roundedY = parseFloat(node.y.toFixed(2));
      if (!yCoordinates.some((y) => Math.abs(y - roundedY) < 0.35)) {
        yCoordinates.push(roundedY);
      }
    }
    yCoordinates.sort((a, b) => a - b);

    if (yCoordinates.length === 0) yCoordinates.push(0);

    const baseElevation = yCoordinates[0];

    // Compute Column Center-to-Center Grid Lines (X & Z) ONLY
    const colGridX: number[] = [];
    const colGridZ: number[] = [];

    // 1. Collect column center positions from all column members
    for (const m of members.values()) {
      if (m.classification === 'COLUMN') {
        const n1 = nodes.get(m.startNodeId);
        const n2 = nodes.get(m.endNodeId);
        if (n1) {
          const rx = parseFloat(n1.x.toFixed(2));
          const rz = parseFloat(n1.z.toFixed(2));
          if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
          if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
        }
        if (n2) {
          const rx = parseFloat(n2.x.toFixed(2));
          const rz = parseFloat(n2.z.toFixed(2));
          if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
          if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
        }
      }
    }

    // 2. Also collect from foundation supports (ground column bases)
    for (const sup of supports.values()) {
      const node = nodes.get(sup.nodeId);
      if (node) {
        const rx = parseFloat(node.x.toFixed(2));
        const rz = parseFloat(node.z.toFixed(2));
        if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
        if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
      }
    }

    colGridX.sort((a, b) => a - b);
    colGridZ.sort((a, b) => a - b);

    // Fallback if no columns found in model
    if (colGridX.length === 0) colGridX.push(model.boundingBox.minX, model.boundingBox.maxX);
    if (colGridZ.length === 0) colGridZ.push(model.boundingBox.minZ, model.boundingBox.maxZ);

    const gridLinesX: GridLineInfo[] = colGridX.map((x, idx) => ({
      id: String(idx + 1),
      axis: 'X',
      coord: x,
      label: `GRID ${idx + 1}`,
    }));

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const gridLinesZ: GridLineInfo[] = colGridZ.map((z, idx) => ({
      id: letters[idx % letters.length] || `Z${idx + 1}`,
      axis: 'Z',
      coord: z,
      label: `GRID ${letters[idx % letters.length] || `Z${idx + 1}`}`,
    }));

    // Extract Grade Beams for foundation level
    const gradeBeamsList = GradeBeamDesignEngine.discoverAndDesignAll(model);

    // Extract Pile Cap Designs for foundation supports — uses batch standardization to match PileCapDesignView table exactly
    const defaultPileTypes = projectPileTypes && projectPileTypes.length > 0
      ? projectPileTypes
      : PileDesignEngine.getDefaultProjectPileTypes();

    const pileCapInputs: import('@/features/design/pilecap/pileCapDesignEngine').PileCapDesignInput[] = [];
    for (const sup of supports.values()) {
      const reactions = model.reactions.filter((r) => r.nodeId === sup.nodeId);
      let maxFy = 650;
      let maxMx = 0;
      let maxMy = 0;
      let govLC = 1;
      for (const r of reactions) {
        if (r.fy > maxFy) {
          maxFy = r.fy;
          maxMx = r.mx;
          maxMy = r.my;
          govLC = r.loadCaseId;
        }
      }

      const assignedTypeId = (supportPileAssignments && supportPileAssignments[sup.nodeId]) || 'P-1';
      const assignedPile = defaultPileTypes.find((p) => p.id === assignedTypeId) || defaultPileTypes[0];
      const overrides = customPileCapOverrides ? customPileCapOverrides[sup.nodeId] : undefined;

      pileCapInputs.push({
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
        factoredMomentX: maxMx,
        factoredMomentY: maxMy,
        fck: 25,
        fy: 500,
        governingLoadCase: govLC,
      });
    }
    const designedPileCaps = pileCapInputs.length > 0
      ? PileCapDesignEngine.batchDesignAndStandardize(pileCapInputs)
      : new Map<number, PileCapDesignOutput>();

    // Pre-detect Combined & Shear Wall Groups for the entire building model
    const pileDp = defaultPileTypes[0]?.diameter || 350;
    const allCombinedPileCaps = CombinedPileCapEngine.detectAndDesignAll(
      model,
      designedPileCaps,
      pileDp,
      manualMergedPileCapGroups || [],
      detachedCombinedCapNodeIds || []
    );

    const absorbedCombinedCapNodeIds = new Set<number>();
    for (const grp of allCombinedPileCaps) {
      grp.absorbedIndividualCaps.forEach((nid) => absorbedCombinedCapNodeIds.add(nid));
      grp.nodeIds.forEach((nid) => absorbedCombinedCapNodeIds.add(nid));
    }

    const floorPlans: FloorPlanLevel[] = [];

    // Build floor plan for each elevation
    yCoordinates.forEach((elevY, index) => {
      const isFoundation = Math.abs(elevY - baseElevation) < 0.35;
      const levelIndex = index;

      let levelName = '';
      let sheetNumber = '';

      if (isFoundation) {
        levelName = `FOUNDATION & PILE CAPS LAYOUT PLAN (EL. ${elevY.toFixed(3)} m)`;
        sheetNumber = 'STR-100';
      } else if (index === 1) {
        levelName = `1ST FLOOR STRUCTURAL FRAMING PLAN (EL. +${elevY.toFixed(3)} m)`;
        sheetNumber = `STR-10${index}`;
      } else if (index === yCoordinates.length - 1) {
        levelName = `ROOF & TERRACE FRAMING PLAN (EL. +${elevY.toFixed(3)} m)`;
        sheetNumber = `STR-10${index}`;
      } else {
        const floorNum = index;
        levelName = `${floorNum}${floorNum === 2 ? 'ND' : floorNum === 3 ? 'RD' : 'TH'} FLOOR STRUCTURAL FRAMING PLAN (EL. +${elevY.toFixed(3)} m)`;
        sheetNumber = `STR-10${index}`;
      }

      // Collect Beams framing at this elevation
      const floorBeams: FloorBeamInfo[] = [];
      let beamCount = 1;

      for (const m of members.values()) {
        if (m.classification === 'BEAM') {
          const n1 = nodes.get(m.startNodeId);
          const n2 = nodes.get(m.endNodeId);
          if (!n1 || !n2) continue;

          // Check if both nodes are near this floor elevation
          if (Math.abs(n1.y - elevY) < 0.4 && Math.abs(n2.y - elevY) < 0.4) {
            const width = m.section.zd || 0.3;
            const depth = m.section.yd || 0.45;
            floorBeams.push({
              memberId: m.id,
              label: `B${beamCount++}`,
              startNodeId: m.startNodeId,
              endNodeId: m.endNodeId,
              startX: n1.x,
              startZ: n1.z,
              endX: n2.x,
              endZ: n2.z,
              length: parseFloat(m.length.toFixed(2)),
              width,
              depth,
              sectionName: `${Math.round(width * 1000)}×${Math.round(depth * 1000)}`,
            });
          }
        }
      }

      // Collect Columns at this floor level
      const floorColumns: FloorColumnInfo[] = [];

      if (isFoundation) {
        // At foundation, map all ground support columns
        for (const sup of supports.values()) {
          const node = nodes.get(sup.nodeId);
          if (!node) continue;
          const supInfo = columnSupportMapping.get(sup.nodeId);
          const pileCap = designedPileCaps.get(sup.nodeId);

          floorColumns.push({
            columnSlNo: supInfo?.columnSlNo || sup.nodeId,
            label: supInfo?.columnLabel || `C${sup.nodeId}`,
            nodeId: sup.nodeId,
            x: node.x,
            z: node.z,
            width: 0.45,
            depth: 0.55,
            sectionName: '450×550',
            isGroundSupport: true,
            pileCap,
          });
        }
      } else {
        // For elevated floors, collect columns intersecting this floor level
        const seenLocations = new Set<string>();
        for (const col of members.values()) {
          if (col.classification === 'COLUMN') {
            const n1 = nodes.get(col.startNodeId);
            const n2 = nodes.get(col.endNodeId);
            if (!n1 || !n2) continue;

            const minY = Math.min(n1.y, n2.y);
            const maxY = Math.max(n1.y, n2.y);

            if (elevY >= minY - 0.35 && elevY <= maxY + 0.35) {
              const colInfo = columnMemberMapping.get(col.id);
              const colNode = Math.abs(n1.y - elevY) < 0.4 ? n1 : n2;
              const locKey = `${colNode.x.toFixed(2)}_${colNode.z.toFixed(2)}`;

              if (!seenLocations.has(locKey)) {
                seenLocations.add(locKey);
                floorColumns.push({
                  memberId: col.id,
                  columnSlNo: colInfo?.columnSlNo || col.id,
                  label: colInfo?.columnLabel || `C${colInfo?.columnSlNo || col.id}`,
                  nodeId: colNode.id,
                  x: colNode.x,
                  z: colNode.z,
                  width: col.section.zd || 0.45,
                  depth: col.section.yd || 0.55,
                  sectionName: `${Math.round((col.section.zd || 0.45) * 1000)}×${Math.round((col.section.yd || 0.55) * 1000)}`,
                  isGroundSupport: false,
                });
              }
            }
          }
        }
      }

      // Slabs / Plates at this elevation (Only genuine horizontal floor plates, ignoring vertical shear wall plates and tiny sub-elements)
      const floorSlabs: FloorSlabPanelInfo[] = [];
      const seenSlabCenters: { x: number; z: number }[] = [];
      let slabCount = 1;

      if (model.plates) {
        for (const p of model.plates.values()) {
          const pNodes = p.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as Node3D[];
          if (pNodes.length >= 3) {
            // Check plate vertical span - vertical wall plates MUST NOT be treated as floor slabs
            const yVals = pNodes.map((n) => n.y);
            const minY = Math.min(...yVals);
            const maxY = Math.max(...yVals);
            if (maxY - minY > 0.20) {
              // Vertical shear wall or core wall plate element
              continue;
            }

            const avgY = yVals.reduce((sum, y) => sum + y, 0) / yVals.length;
            if (Math.abs(avgY - elevY) < 0.4) {
              // Calculate 2D polygon area
              let area = 0;
              for (let i = 0; i < pNodes.length; i++) {
                const j = (i + 1) % pNodes.length;
                area += pNodes[i].x * pNodes[j].z - pNodes[j].x * pNodes[i].z;
              }
              area = Math.abs(area) / 2;

              // Ignore tiny meshed fragments (< 0.8 m2)
              if (area < 0.8) continue;

              // Calculate centroid
              const cx = pNodes.reduce((sum, n) => sum + n.x, 0) / pNodes.length;
              const cz = pNodes.reduce((sum, n) => sum + n.z, 0) / pNodes.length;

              // Avoid duplicate / overlapping slab labels if centers are within 1.8m
              const isOverlap = seenSlabCenters.some(
                (c) => Math.hypot(c.x - cx, c.z - cz) < 1.8
              );
              if (isOverlap) continue;

              seenSlabCenters.push({ x: cx, z: cz });

              floorSlabs.push({
                id: p.id,
                label: `S${slabCount++}`,
                points: pNodes.map((n) => ({ x: n.x, z: n.z })),
                thickness: Math.round((p.thickness || 0.15) * 1000),
                areaM2: parseFloat(area.toFixed(1)),
              });
            }
          }
        }
      }

      // Grade Beams for foundation
      const floorGradeBeams: FloorGradeBeamInfo[] = isFoundation
        ? gradeBeamsList.map((gb) => {
            const n1 = nodes.get(gb.startNodeId);
            const n2 = nodes.get(gb.endNodeId);
            return {
              gradeBeamId: gb.gradeBeamId,
              startColumnLabel: gb.startColumnLabel,
              endColumnLabel: gb.endColumnLabel,
              startX: n1 ? n1.x : 0,
              startZ: n1 ? n1.z : 0,
              endX: n2 ? n2.x : 0,
              endZ: n2 ? n2.z : 0,
              length: gb.spanLength,
              width: gb.b,
              depth: gb.D,
            };
          })
        : [];

      // Calculate Bounding Coordinates
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (const col of floorColumns) {
        minX = Math.min(minX, col.x - 1.5);
        maxX = Math.max(maxX, col.x + 1.5);
        minZ = Math.min(minZ, col.z - 1.5);
        maxZ = Math.max(maxZ, col.z + 1.5);
      }

      if (minX === Infinity) {
        minX = model.boundingBox.minX;
        maxX = model.boundingBox.maxX;
        minZ = model.boundingBox.minZ;
        maxZ = model.boundingBox.maxZ;
      }

      const bounds = {
        minX: parseFloat(minX.toFixed(2)),
        maxX: parseFloat(maxX.toFixed(2)),
        minZ: parseFloat(minZ.toFixed(2)),
        maxZ: parseFloat(maxZ.toFixed(2)),
        width: parseFloat((maxX - minX).toFixed(2)),
        height: parseFloat((maxZ - minZ).toFixed(2)),
      };

      // Quantities Takeoff for this Floor Level
      let totalBeamConcreteM3 = 0;
      let totalColConcreteM3 = 0;
      let totalSlabConcreteM3 = 0;

      for (const b of floorBeams) {
        totalBeamConcreteM3 += b.width * b.depth * b.length;
      }

      for (const c of floorColumns) {
        totalColConcreteM3 += c.width * c.depth * 3.5;
      }

      for (const s of floorSlabs) {
        totalSlabConcreteM3 += (s.thickness / 1000) * s.areaM2;
      }

      const totalConcreteM3 = parseFloat(
        (totalBeamConcreteM3 + totalColConcreteM3 + totalSlabConcreteM3).toFixed(1)
      );
      const totalSteelKg = parseFloat((totalConcreteM3 * 85).toFixed(1));
      const totalFloorAreaM2 = parseFloat(
        floorSlabs.length > 0
          ? floorSlabs.reduce((sum, s) => sum + s.areaM2, 0).toFixed(1)
          : (bounds.width * bounds.height).toFixed(1)
      );

      floorPlans.push({
        levelIndex,
        levelName,
        sheetNumber,
        elevationY: elevY,
        isFoundationLevel: isFoundation,
        beams: floorBeams,
        columns: floorColumns,
        gradeBeams: floorGradeBeams,
        slabs: floorSlabs,
        gridLinesX,
        gridLinesZ,
        combinedPileCaps: allCombinedPileCaps,
        absorbedCombinedCapNodeIds,
        bounds,
        metrics: {
          totalBeams: floorBeams.length,
          totalColumns: floorColumns.length,
          totalSlabs: floorSlabs.length,
          totalConcreteM3,
          totalSteelKg,
          totalFloorAreaM2,
        },
      });
    });

    return floorPlans;
  }
}
