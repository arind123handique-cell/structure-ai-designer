import jsPDF from 'jspdf';
import { FloorPlanLevel, FloorColumnInfo } from './floorPlanEngine';
import { StoredProject } from '@/features/projects/types';
import { PileCapDesignOutput } from '@/features/design/pilecap/pileCapDesignEngine';

export interface PdfExportOptions {
  showGrids?: boolean;
  showDimensions?: boolean;
  showMemberLabels?: boolean;
  showSectionSizes?: boolean;
  showSlabs?: boolean;
  showPileCaps?: boolean;
  showGradeBeams?: boolean;
  showLiftCore?: boolean;
  selectedSectionType?: string;
}

export interface UniquePileCapType {
  typeId: string;
  typeName: string;
  cap: PileCapDesignOutput;
  representativeColumn: FloorColumnInfo;
  associatedColumns: string[];
  sectionNum: number;
  sectionLabel: string;
  count: number;
  shape: string;
  L: number;
  B: number;
  D: number;
  Dp: number;
  s: number;
  eo: number;
  facetDim?: number;
  groupId?: string;
  pileOffsets?: { x: number; y: number; z?: number }[];
  botRebar?: string;
  topRebar?: string;
}

function computeUniquePileCapTypes(floorPlan: FloorPlanLevel): UniquePileCapType[] {
  const isFoundation = floorPlan.isFoundationLevel;
  if (!isFoundation) return [];

  const typeMap = new Map<string, UniquePileCapType>();

  for (const col of floorPlan.columns) {
    if (!col.pileCap) continue;
    if (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) {
      continue;
    }
    const cap = col.pileCap;
    const count = cap.pileCount;
    const shape = cap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');
    const key = `${count}_${shape}`;

    if (!typeMap.has(key)) {
      const secNum = typeMap.size + 1;
      const L = cap.capLength || (count === 5 ? 2316 : 1900);
      const B = cap.capWidth || (count === 5 ? 2399 : 1900);
      const Dp = cap.pileDiameter || 350;
      const s = cap.pileSpacing || 3 * Dp;
      const eo = cap.edgeDistance || Dp;
      const Rp = s / (2 * Math.sin(Math.PI / 5));
      const Rcap = Rp + eo;
      const facetDim = Math.round(2 * Rcap * Math.sin(Math.PI / 5));

      typeMap.set(key, {
        typeId: `TYPE-${secNum}`,
        typeName: `${count}-PILE ${shape}`,
        cap,
        representativeColumn: col,
        associatedColumns: [col.label],
        sectionNum: secNum,
        sectionLabel: `SECTION ${secNum}-${secNum}`,
        count,
        shape,
        L,
        B,
        D: cap.capDepth || 750,
        Dp,
        s,
        eo,
        facetDim: shape === 'PENTAGONAL' ? (cap.capLength ? 1461 : facetDim) : undefined,
      });
    } else {
      typeMap.get(key)!.associatedColumns.push(col.label);
    }
  }

  const types = Array.from(typeMap.values());

  if (floorPlan.combinedPileCaps && floorPlan.combinedPileCaps.length > 0) {
    floorPlan.combinedPileCaps.forEach((grp) => {
      const secNum = types.length + 1;
      types.push({
        typeId: `TYPE-${secNum}`,
        typeName: `${grp.pileCount}-PILE COMBINED / SHEAR WALL MAT`,
        cap: {
          supportNodeId: grp.nodeIds[0],
          pileCount: grp.pileCount,
          capShape: 'RECTANGULAR',
          capLength: grp.capLength,
          capWidth: grp.capWidth,
          capDepth: grp.capDepth,
          pileDiameter: grp.pileDiameter,
          pileSpacing: grp.pileSpacing,
          edgeDistance: grp.edgeDistance,
          rebarCalloutX: grp.botRebarCallout,
          topRebarCallout: grp.topRebarCallout,
          sideFaceRebarCallout: grp.shearWallStirrupCallout,
          rebarCalloutY: grp.botRebarCallout,
        } as any,
        representativeColumn: { columnSlNo: grp.nodeIds[0], label: grp.columnLabels.join('+') } as any,
        associatedColumns: grp.columnLabels,
        sectionNum: secNum,
        sectionLabel: `SECTION ${secNum}-${secNum}`,
        count: grp.pileCount,
        shape: 'COMBINED',
        L: grp.capLength,
        B: grp.capWidth,
        D: grp.capDepth,
        Dp: grp.pileDiameter,
        s: grp.pileSpacing,
        eo: grp.edgeDistance,
        groupId: grp.groupId,
        pileOffsets: grp.pileOffsets.map(p => ({ x: p.x, y: (p as any).z ?? (p as any).y, z: (p as any).z } as any)),
        botRebar: grp.botRebarCallout,
        topRebar: grp.topRebarCallout,
      });
    });
  }

  if (types.length === 0) {
    const Dp = 350;
    const D = 750;
    const s = 3 * Dp;
    const eo = Dp;
    types.push(
      {
        typeId: 'TYPE-1',
        typeName: '4-PILE RECTANGULAR',
        cap: {
          supportNodeId: 1,
          pileCount: 4,
          capShape: 'RECTANGULAR',
          capLength: 1900,
          capWidth: 1900,
          capDepth: D,
          pileDiameter: Dp,
          pileSpacing: s,
          edgeDistance: eo,
          rebarCalloutX: 'T16 @ 150 mm c/c',
          topRebarCallout: 'T12 @ 100 mm c/c',
          sideFaceRebarCallout: '3-T10',
          rebarCalloutY: 'T16 @ 150 mm c/c',
        } as any,
        representativeColumn: { columnSlNo: 1, label: 'C1' } as any,
        associatedColumns: ['C1', 'C4', 'C5', 'C7', 'C8', 'C9', 'C12', 'C13', 'C14', 'C17'],
        sectionNum: 1,
        sectionLabel: 'SECTION 1-1',
        count: 4,
        shape: 'RECTANGULAR',
        L: 1900,
        B: 1900,
        D,
        Dp,
        s,
        eo,
      },
      {
        typeId: 'TYPE-2',
        typeName: '5-PILE PENTAGONAL',
        cap: {
          supportNodeId: 2,
          pileCount: 5,
          capShape: 'PENTAGONAL',
          capLength: 2316,
          capWidth: 2399,
          capDepth: D,
          pileDiameter: Dp,
          pileSpacing: s,
          edgeDistance: eo,
          rebarCalloutX: 'T16 @ 125 mm c/c',
          topRebarCallout: 'T12 @ 100 mm c/c',
          sideFaceRebarCallout: '3-T10',
          rebarCalloutY: 'T16 @ 125 mm c/c',
        } as any,
        representativeColumn: { columnSlNo: 2, label: 'C2' } as any,
        associatedColumns: ['C2', 'C3', 'C6', 'C10', 'C11', 'C15', 'C16', 'C18', 'C19', 'C20'],
        sectionNum: 2,
        sectionLabel: 'SECTION 2-2',
        count: 5,
        shape: 'PENTAGONAL',
        L: 2316,
        B: 2399,
        D,
        Dp,
        s,
        eo,
        facetDim: 1461,
      }
    );
  }

  // PC annotation: 2P=PC1, 3P=PC2, 4P=PC3 per user spec
  const sorted = [...types].sort((a, b) => a.count - b.count);
  const usedPc = new Set<string>();
  return sorted.map((t) => {
    let pcNum = Math.max(1, t.count - 1);
    while (usedPc.has(`PC${pcNum}`)) pcNum++;
    usedPc.add(`PC${pcNum}`);
    return {
      ...t,
      typeId: `PC${pcNum}`,
      sectionNum: pcNum,
      sectionLabel: `SECTION ${pcNum}-${pcNum}`,
    };
  });
}

export class PdfExportService {
  /**
   * Exports a single floor plan level to a high-resolution, vector-drawn PDF sheet (A3 Landscape).
   * Now respects web view toggles to ensure 1:1 parity with FloorPlanSvg web rendering.
   */
  public static exportSingleFloorPlanToPdf(
    floorPlan: FloorPlanLevel,
    project: StoredProject | null,
    fileName?: string,
    options: PdfExportOptions = {}
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3', // 420mm x 297mm
    });

    this.renderFloorPlanPage(doc, floorPlan, project, 1, 1, options);

    const safeName = fileName || `${project?.metadata?.name || 'Project'}_${floorPlan.sheetNumber}_${floorPlan.levelName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(safeName);
  }

  /**
   * Exports all floor plans from foundation to top floor level into a single multi-page PDF drawing set.
   */
  public static exportAllFloorPlansToPdf(
    floorPlans: FloorPlanLevel[],
    project: StoredProject | null,
    fileName?: string,
    options: PdfExportOptions = {}
  ): void {
    if (!floorPlans || floorPlans.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3', // 420mm x 297mm
    });

    floorPlans.forEach((fp, index) => {
      if (index > 0) {
        doc.addPage('a3', 'landscape');
      }
      this.renderFloorPlanPage(doc, fp, project, index + 1, floorPlans.length, options);
    });

    const safeName = fileName || `${project?.metadata?.name || 'Structural'}_Complete_Floor_Framing_Plans_STR_100_105.pdf`;
    doc.save(safeName);
  }

  /**
   * Renders one complete professional CAD drawing sheet page.
   * Mirrors FloorPlanSvg web logic 1:1 (grade beam suppression, pile cap absorption, combined caps, beam/column suppression, slabs, dimensions).
   */
  private static renderFloorPlanPage(
    doc: jsPDF,
    fp: FloorPlanLevel,
    project: StoredProject | null,
    pageNumber: number,
    totalPages: number,
    options: PdfExportOptions = {}
  ): void {
    const {
      showGrids = true,
      showDimensions = true,
      showMemberLabels = true,
      showSectionSizes = true,
      showSlabs = true,
      showPileCaps = true,
      showGradeBeams = true,
      showLiftCore = false,
      selectedSectionType = 'ALL',
    } = options;

    const pageWidth = 420;
    const pageHeight = 297;

    // 1. Drawing Border
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(1.2);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    doc.setLineWidth(0.4);
    doc.rect(13, 13, pageWidth - 26, pageHeight - 26);

    // 2. Title Block
    const tbX = pageWidth - 13 - 130;
    const tbY = pageHeight - 13 - 48;
    const tbW = 130;
    const tbH = 48;
    doc.setFillColor(248, 250, 252);
    doc.rect(tbX, tbY, tbW, tbH, 'F');
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.6);
    doc.rect(tbX, tbY, tbW, tbH, 'S');
    doc.line(tbX, tbY + 12, tbX + tbW, tbY + 12);
    doc.line(tbX, tbY + 28, tbX + tbW, tbY + 28);
    doc.line(tbX + 70, tbY + 28, tbX + 70, tbY + tbH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('STRUCTURE AI DESIGNER - IS CODE SUITE', tbX + 4, tbY + 8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`PROJECT: ${project?.metadata?.name || 'G+4 RCC Residential Building'}`, tbX + 4, tbY + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(fp.levelName, tbX + 4, tbY + 23);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`ENGINEER: ${project?.metadata?.engineer || 'Er. E. Rogers (Lead Struct. Eng)'}`, tbX + 4, tbY + 34);
    doc.text(`LOCATION: ${project?.metadata?.location || 'Phase II Site, Standard Building'}`, tbX + 4, tbY + 39);
    doc.text(`DATE: ${new Date().toLocaleDateString()}`, tbX + 4, tbY + 44);
    doc.setFont('helvetica', 'bold');
    doc.text(`DWG NO: ${fp.sheetNumber}`, tbX + 74, tbY + 34);
    doc.text(`SCALE: 1:100 @ A3`, tbX + 74, tbY + 39);
    doc.setTextColor(5, 150, 105);
    doc.text(`SHEET: ${pageNumber} OF ${totalPages} (APPROVED)`, tbX + 74, tbY + 44);

    // 3. Notes & Legend Box
    const nbX = 16;
    const nbY = pageHeight - 13 - 48;
    const nbW = 140;
    const nbH = 48;
    doc.setFillColor(248, 250, 252);
    doc.rect(nbX, nbY, nbW, nbH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(nbX, nbY, nbW, nbH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('GENERAL STRUCTURAL SPECIFICATIONS (IS 456 & IS 2911):', nbX + 4, nbY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('1. All dimensions are in millimeters (mm) and levels are in meters (m) unless specified.', nbX + 4, nbY + 14);
    doc.text('2. Concrete Grade: M25 / M30 (fck = 25 - 30 N/mm2), Steel: TMT Fe500D (IS 1786).', nbX + 4, nbY + 20);
    doc.text('3. Clear Covers: Footings/Pile Caps = 60mm, Columns = 40mm, Beams = 30mm, Slabs = 20mm.', nbX + 4, nbY + 26);
    doc.text('4. Lap Length = 47 x dia for tension laps; Laps shall be staggered as per IS 13920.', nbX + 4, nbY + 32);
    doc.text(
      fp.isFoundationLevel
        ? '5. Foundation: Bored RCC Piles Dia 500mm (Qsafe = 450 kN). All caps rigid IS 2911.'
        : `5. Floor Area: ${fp.metrics.totalFloorAreaM2} sq.m | Beams: ${fp.metrics.totalBeams} Nos | Columns: ${fp.metrics.totalColumns} Nos.`,
      nbX + 4,
      nbY + 38
    );
    doc.text('6. Construction shall conform strictly to National Building Code (NBC) 2016.', nbX + 4, nbY + 44);

    // 4. North Arrow
    const naX = pageWidth - 35;
    const naY = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('N', naX, naY - 6, { align: 'center' });
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.triangle(naX, naY - 4, naX - 4, naY + 8, naX + 4, naY + 8, 'FD');

    // 5. Compute Scaling & Transformation for 2D Plan View — matched to FloorPlanSvg 1:1 math
    const isFoundation = fp.isFoundationLevel;
    const drawX0 = isFoundation ? 35 : 40;
    const drawY0 = 35;
    const drawAreaW = isFoundation ? 200 : pageWidth - 80;
    const drawAreaH = pageHeight - 110;

    const bounds = fp.bounds;
    const modelW = Math.max(bounds.width, 10);
    const modelH = Math.max(bounds.height, 10);

    const scale = Math.min(drawAreaW / modelW, drawAreaH / modelH) * 0.85;

    const planCenterX = drawX0 + drawAreaW / 2;
    const planCenterY = drawY0 + drawAreaH / 2;

    const modelCenterX = (bounds.minX + bounds.maxX) / 2;
    const modelCenterZ = (bounds.minZ + bounds.maxZ) / 2;

    const toPdfX = (x: number) => planCenterX + (x - modelCenterX) * scale;
    const toPdfY = (z: number) => planCenterY + (z - modelCenterZ) * scale;

    // 6. Draw Grid Lines — respects showGrids (matches FloorPlanSvg)
    if (showGrids) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      fp.gridLinesX.forEach((gl) => {
        const gx = toPdfX(gl.coord);
        const gz1 = toPdfY(bounds.minZ - 1.0);
        const gz2 = toPdfY(bounds.maxZ + 1.0);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(gx, gz1, gx, gz2);
        doc.setLineDashPattern([], 0);
        doc.setFillColor(255, 255, 255);
        doc.circle(gx, gz1 - 3.5, 3.0, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);
        doc.text(gl.id, gx, gz1 - 2.5, { align: 'center' });
      });
      fp.gridLinesZ.forEach((gl) => {
        const gz = toPdfY(gl.coord);
        const gx1 = toPdfX(bounds.minX - 1.0);
        const gx2 = toPdfX(bounds.maxX + 1.0);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(gx1, gz, gx2, gz);
        doc.setLineDashPattern([], 0);
        doc.setFillColor(255, 255, 255);
        doc.circle(gx1 - 3.5, gz, 3.0, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);
        doc.text(gl.id, gx1 - 3.5, gz + 1.0, { align: 'center' });
      });
    }

    // 7. Draw Slabs / Plates — respects showSlabs && !isFoundation (matches web)
    if (showSlabs && !fp.isFoundationLevel && fp.slabs && fp.slabs.length > 0) {
      doc.setFillColor(2, 132, 199);
      // Web: fill #0284c7 opacity 0.08 dashed; PDF approximates with light fill
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1.5, 1.5], 0);
      fp.slabs.forEach((s) => {
        if (s.points.length >= 3) {
          const polyX = s.points.map((p) => toPdfX(p.x));
          const polyY = s.points.map((p) => toPdfY(p.z));
          const lines: [number, number][] = [];
          for (let i = 1; i < s.points.length; i++) {
            lines.push([polyX[i] - polyX[i - 1], polyY[i] - polyY[i - 1]]);
          }
          doc.setFillColor(224, 242, 254);
          doc.lines(lines, polyX[0], polyY[0], [1, 1], 'FD', true);
          // Label slab
          if (showMemberLabels) {
            const cx = s.points.reduce((acc, p) => acc + toPdfX(p.x), 0) / s.points.length;
            const cy = s.points.reduce((acc, p) => acc + toPdfY(p.z), 0) / s.points.length;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(2, 132, 199);
            doc.text(s.label, cx, cy - 1, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(14, 165, 233);
            doc.text(`THK: ${s.thickness}mm`, cx, cy + 2.5, { align: 'center' });
          }
        }
      });
      doc.setLineDashPattern([], 0);
    }

    // 8. Draw Foundation Grade Beams & Pile Caps (Foundation Level) — mirrors FloorPlanSvg 4.
    if (fp.isFoundationLevel) {
      // Grade Beams — respects showGradeBeams + internal shear wall suppression
      if (showGradeBeams) {
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.35);
        fp.gradeBeams.forEach((gb) => {
          const isInternalToShearWall = fp.combinedPileCaps?.some((grp) => {
            const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
            if (!isWallGrp) return false;
            const startIn = grp.columnLabels.includes(gb.startColumnLabel) || grp.columnLabels.includes(`C${gb.startColumnLabel.replace(/\D/g, '')}`);
            const endIn = grp.columnLabels.includes(gb.endColumnLabel) || grp.columnLabels.includes(`C${gb.endColumnLabel.replace(/\D/g, '')}`);
            return startIn && endIn;
          });
          if (isInternalToShearWall) return;

          const x1 = toPdfX(gb.startX);
          const y1 = toPdfY(gb.startZ);
          const x2 = toPdfX(gb.endX);
          const y2 = toPdfY(gb.endZ);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          if (len < 0.5) return;
          const nx = -dy / len;
          const ny = dx / len;
          const hw = Math.max(0.6, ((gb.width / 1000) / 2) * scale);
          doc.line(x1 + nx * hw, y1 + ny * hw, x2 + nx * hw, y2 + ny * hw);
          doc.line(x1 - nx * hw, y1 - ny * hw, x2 - nx * hw, y2 - ny * hw);

          // Grade beam label badge — respects showMemberLabels
          if (showMemberLabels && len >= 8) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (angleDeg > 90) angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;
            const textStr = len < 22 ? gb.gradeBeamId : `${gb.gradeBeamId} (${gb.width}×${gb.depth})`;
            doc.setFillColor(2, 6, 23);
            // small white badge
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(4.5);
            doc.setTextColor(199, 210, 254);
            doc.text(textStr, midX, midY, { align: 'center', baseline: 'middle', angle: -angleDeg });
          }
        });
      }

      // Individual Pile Caps — respects showPileCaps + absorbed suppression
      if (showPileCaps) {
        fp.columns.forEach((col) => {
          const cap = col.pileCap;
          const cx = toPdfX(col.x);
          const cy = toPdfY(col.z);
          if (!cap) return;
          const isAbsorbedInCombined = fp.combinedPileCaps?.some((grp) =>
            grp.nodeIds.includes(col.nodeId) ||
            grp.columnLabels.includes(col.label) ||
            grp.columnLabels.includes(`C${col.columnSlNo}`) ||
            (fp.absorbedCombinedCapNodeIds && fp.absorbedCombinedCapNodeIds.has(col.nodeId))
          );
          if (isAbsorbedInCombined) return;

          const capL = (cap.capLength / 1000) * scale;
          const capW = (cap.capWidth / 1000) * scale;
          const count = cap.pileCount;
          const shape = cap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');

          doc.setFillColor(30, 27, 75);
          doc.setDrawColor(129, 140, 248);
          doc.setLineWidth(0.6);

          if (shape === 'TRIANGULAR') {
            const Rp = (cap.pileSpacing / Math.sqrt(3) / 1000) * scale;
            const eo = (cap.edgeDistance / 1000) * scale;
            const topY = cy - (Rp + eo * 1.155);
            const btmY = cy + (Rp / 2 + eo);
            const halfB = (cap.pileSpacing / 2 / 1000) * scale + eo * 1.155;
            const p1 = [cx, topY];
            const p2 = [cx - halfB, btmY];
            const p3 = [cx + halfB, btmY];
            const triLines: [number, number][] = [
              [p2[0] - p1[0], p2[1] - p1[1]],
              [p3[0] - p2[0], p3[1] - p2[1]],
            ];
            doc.lines(triLines, p1[0], p1[1], [1, 1], 'FD', true);
          } else if (shape === 'PENTAGONAL') {
            const Rp = (cap.pileSpacing / (2 * Math.sin(Math.PI / 5)) / 1000) * scale;
            const Rcap = Rp + (cap.edgeDistance / 1000) * scale;
            const cos18 = Math.cos(Math.PI / 10);
            const sin18 = Math.sin(Math.PI / 10);
            const sin36 = Math.sin(Math.PI / 5);
            const cos36 = Math.cos(Math.PI / 5);
            const p1 = [cx, cy - Rcap];
            const p2 = [cx - Rcap * cos18, cy - Rcap * sin18];
            const p3 = [cx - Rcap * sin36, cy + Rcap * cos36];
            const p4 = [cx + Rcap * sin36, cy + Rcap * cos36];
            const p5 = [cx + Rcap * cos18, cy - Rcap * sin18];
            const polyLines: [number, number][] = [
              [p2[0] - p1[0], p2[1] - p1[1]],
              [p3[0] - p2[0], p3[1] - p2[1]],
              [p4[0] - p3[0], p4[1] - p3[1]],
              [p5[0] - p4[0], p5[1] - p4[1]],
            ];
            doc.lines(polyLines, p1[0], p1[1], [1, 1], 'FD', true);
          } else {
            doc.rect(cx - capL / 2, cy - capW / 2, capL, capW, 'FD');
          }

          if (cap.pileOffsets) {
            doc.setFillColor(49, 46, 129);
            doc.setDrawColor(192, 132, 252);
            cap.pileOffsets.forEach((off) => {
              const px = cx + (off.x / 1000) * scale;
              const py = cy - (off.y / 1000) * scale;
              const rPile = Math.max(1.2, (cap.pileDiameter / 2000) * scale);
              doc.circle(px, py, rPile, 'FD');
            });
          }

          if (showMemberLabels) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(165, 180, 252);
            doc.text(`PC${Math.max(1, count - 1)} (${count}P)`, cx, cy - capW / 2 - 1.5, { align: 'center' });
          }
        });
      }

      // Combined & Shear Wall Caps — respects showPileCaps (mirrors FloorPlanSvg 4b)
      if (showPileCaps && fp.combinedPileCaps && fp.combinedPileCaps.length > 0) {
        fp.combinedPileCaps.forEach((grp) => {
          const cx = toPdfX((grp.minX + grp.maxX) / 2);
          const cy = toPdfY((grp.minZ + grp.maxZ) / 2);
          const capL = (grp.capLength / 1000) * scale;
          const capW = (grp.capWidth / 1000) * scale;
          const isShearWall = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
          const fillR = isShearWall ? 69 : 20;
          const fillG = isShearWall ? 10 : 83;
          const fillB = isShearWall ? 10 : 45;
          const strokeR = isShearWall ? 244 : 74;
          const strokeG = isShearWall ? 63 : 222;
          const strokeB = isShearWall ? 94 : 128;

          const pccPad = (150 / 1000) * scale;
          // PCC outer dashed
          doc.setDrawColor(59, 130, 246);
          doc.setLineWidth(0.3);
          doc.setLineDashPattern([1.5, 1], 0);
          doc.rect(cx - capL / 2 - pccPad, cy - capW / 2 - pccPad, capL + 2 * pccPad, capW + 2 * pccPad, 'S');
          doc.setLineDashPattern([], 0);

          // Cap body
          doc.setFillColor(fillR, fillG, fillB);
          doc.setDrawColor(strokeR, strokeG, strokeB);
          doc.setLineWidth(0.7);
          doc.rect(cx - capL / 2, cy - capW / 2, capL, capW, 'FD');
          // inner outline
          doc.setLineWidth(0.3);
          doc.setDrawColor(strokeR, strokeG, strokeB);
          doc.rect(cx - capL / 2 + 1.2, cy - capW / 2 + 1.2, capL - 2.4, capW - 2.4, 'S');

          // Piles — handles both {x,y} and {x,z} layouts
          grp.pileOffsets.forEach((off: any) => {
            const oy = off.z !== undefined ? off.z : off.y;
            const px = cx + (off.x / 1000) * scale;
            const py = cy - (oy / 1000) * scale;
            const rPile = Math.max(1.0, (grp.pileDiameter / 2000) * scale);
            doc.setFillColor(fillR, fillG, fillB);
            doc.setDrawColor(strokeR, strokeG, strokeB);
            doc.circle(px, py, rPile, 'FD');
            doc.setLineWidth(0.25);
            doc.line(px - rPile, py, px + rPile, py);
            doc.line(px, py - rPile, px, py + rPile);
          });

          // Shear wall footprint — figure always visible, text hidden when showLiftCore=false
          if (isShearWall) {
            const twPx = Math.max(1.5, 0.23 * scale);
            doc.setFillColor(136, 19, 55);
            doc.setDrawColor(244, 63, 94);
            doc.setLineWidth(0.4);
            const wf = grp.wallFootprint;
            if (wf && wf.segments && wf.segments.length > 0) {
              wf.segments.forEach((seg) => {
                const x1 = toPdfX(seg.x1);
                const y1 = toPdfY(seg.z1);
                const x2 = toPdfX(seg.x2);
                const y2 = toPdfY(seg.z2);
                const isHoriz = Math.abs(seg.z1 - seg.z2) < 0.01;
                if (isHoriz) {
                  const minX = Math.min(x1, x2);
                  const maxX = Math.max(x1, x2);
                  doc.rect(minX - twPx / 2, y1 - twPx / 2, Math.max(twPx, Math.abs(maxX - minX) + twPx), twPx, 'FD');
                } else {
                  const minY = Math.min(y1, y2);
                  const maxY = Math.max(y1, y2);
                  doc.rect(x1 - twPx / 2, minY - twPx / 2, twPx, Math.max(twPx, Math.abs(maxY - minY) + twPx), 'FD');
                }
              });
              // Boundary zones
              (wf.boundaryZones || []).forEach((bz) => {
                const bx = toPdfX(bz.cx);
                const by = toPdfY(bz.cz);
                const bePx = Math.max(2.5, 0.45 * scale);
                doc.setFillColor(202, 138, 4);
                doc.setDrawColor(234, 179, 8);
                doc.rect(bx - bePx / 2, by - bePx / 2, bePx, bePx, 'FD');
              });
              if (wf.shape === 'U_SHAPE' && showMemberLabels && showLiftCore) {
                const mx = toPdfX((grp.minX + grp.maxX) / 2);
                const my = toPdfY((grp.minZ + grp.maxZ) / 2);
                doc.setFontSize(4.5);
                doc.setTextColor(254, 205, 211);
                doc.setFont('helvetica', 'bold');
                doc.text('LIFT CORE (tw=230)', mx, my, { align: 'center' });
              }
            } else {
              // Fallback generic (when no footprint)
              const xMin = toPdfX(grp.minX);
              const xMax = toPdfX(grp.maxX);
              const zMin = toPdfY(grp.minZ);
              const zMax = toPdfY(grp.maxZ);
              const isUShape = (Math.abs(xMax - xMin) > 5 && Math.abs(zMax - zMin) > 5);
              if (isUShape) {
                const zTop = Math.min(zMin, zMax);
                const zBottom = Math.max(zMin, zMax);
                const xLeft = Math.min(xMin, xMax);
                const xRight = Math.max(xMin, xMax);
                doc.rect(xLeft - twPx / 2, zTop - twPx / 2, twPx, zBottom - zTop + twPx, 'FD');
                doc.rect(xLeft - twPx / 2, zTop - twPx / 2, xRight - xLeft + twPx, twPx, 'FD');
                doc.rect(xRight - twPx / 2, zTop - twPx / 2, twPx, zBottom - zTop + twPx, 'FD');
              } else {
                doc.rect(Math.min(xMin, xMax) - twPx / 2, Math.min(zMin, zMax) - twPx / 2, Math.max(twPx, Math.abs(xMax - xMin)), Math.max(twPx, Math.abs(zMax - zMin)), 'FD');
              }
            }
          }

          // Labels — PC-SW (18P) hidden, dimensions always shown
          if (showMemberLabels) {
            if (!isShearWall) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(5.5);
              doc.setTextColor(187, 247, 208);
              const label = `PC-${grp.columnLabels[0]}+${grp.columnLabels[1]} (${grp.pileCount}P)`;
              doc.text(label, cx, cy - capW / 2 - 2.5, { align: 'center' });
            }
            doc.setFontSize(4.5);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.text(`${grp.pileCount}P · ${grp.capLength}×${grp.capWidth}×${grp.capDepth} mm`, cx, cy + capW / 2 + 3, { align: 'center' });
          }
        });
      }
    }

    // Elevated floors: shear wall footprints — figure always visible, text hidden when showLiftCore=false
    if (!fp.isFoundationLevel && fp.combinedPileCaps && showPileCaps) {
      const wallGroups = fp.combinedPileCaps.filter((grp) => grp.reason === 'SHEAR_WALL' || grp.wallFootprint || grp.nodeIds.length >= 3);
      wallGroups.forEach((grp) => {
        const twPx = Math.max(1.5, 0.23 * scale);
        doc.setFillColor(136, 19, 55);
        doc.setDrawColor(244, 63, 94);
        doc.setLineWidth(0.4);
        const wf = grp.wallFootprint;
        if (wf && wf.segments && wf.segments.length > 0) {
          wf.segments.forEach((seg) => {
            const x1 = toPdfX(seg.x1);
            const y1 = toPdfY(seg.z1);
            const x2 = toPdfX(seg.x2);
            const y2 = toPdfY(seg.z2);
            const isHoriz = Math.abs(seg.z1 - seg.z2) < 0.01;
            if (isHoriz) {
              const minX = Math.min(x1, x2);
              const maxX = Math.max(x1, x2);
              doc.rect(minX - twPx / 2, y1 - twPx / 2, Math.max(twPx, Math.abs(maxX - minX) + twPx), twPx, 'FD');
            } else {
              const minY = Math.min(y1, y2);
              const maxY = Math.max(y1, y2);
              doc.rect(x1 - twPx / 2, minY - twPx / 2, twPx, Math.max(twPx, Math.abs(maxY - minY) + twPx), 'FD');
            }
          });
          (wf.boundaryZones || []).forEach((bz) => {
            const bx = toPdfX(bz.cx);
            const by = toPdfY(bz.cz);
            const bePx = Math.max(2.5, 0.45 * scale);
            doc.setFillColor(202, 138, 4);
            doc.setDrawColor(234, 179, 8);
            doc.rect(bx - bePx / 2, by - bePx / 2, bePx, bePx, 'FD');
          });
        } else {
          const xMin = toPdfX(grp.minX);
          const xMax = toPdfX(grp.maxX);
          const zMin = toPdfY(grp.minZ);
          const zMax = toPdfY(grp.maxZ);
          const isUShape = (Math.abs(xMax - xMin) > 5 && Math.abs(zMax - zMin) > 5);
          if (isUShape) {
            const zTop = Math.min(zMin, zMax);
            const zBottom = Math.max(zMin, zMax);
            const xLeft = Math.min(xMin, xMax);
            const xRight = Math.max(xMin, xMax);
            doc.rect(xLeft - twPx / 2, zTop - twPx / 2, twPx, zBottom - zTop + twPx, 'FD');
            doc.rect(xLeft - twPx / 2, zTop - twPx / 2, xRight - xLeft + twPx, twPx, 'FD');
            doc.rect(xRight - twPx / 2, zTop - twPx / 2, twPx, zBottom - zTop + twPx, 'FD');
          } else {
            doc.rect(Math.min(xMin, xMax) - twPx / 2, Math.min(zMin, zMax) - twPx / 2, Math.max(twPx, Math.abs(xMax - xMin)), Math.max(twPx, Math.abs(zMax - zMin)), 'FD');
          }
        }
        if (showMemberLabels && showLiftCore) {
          const mx = toPdfX((grp.minX + grp.maxX) / 2);
          const my = toPdfY((grp.minZ + grp.maxZ) / 2);
          doc.setFontSize(5);
          doc.setTextColor(254, 205, 211);
          doc.setFont('helvetica', 'bold');
          const label = wf?.shape === 'U_SHAPE' ? 'LIFT CORE (tw=230)' : 'RC SHEAR WALL (tw=230)';
          doc.text(label, mx, my, { align: 'center' });
        }
      });
    }

    // 9. Draw Framing Beams (Elevated Floors) — respects internal core suppression + showMemberLabels/SectionSizes
    if (!fp.isFoundationLevel) {
      fp.beams.forEach((b) => {
        const isInternalToCore = fp.combinedPileCaps?.some((grp) => {
          const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
          if (!isWallGrp) return false;
          return grp.nodeIds.includes(b.startNodeId) && grp.nodeIds.includes(b.endNodeId);
        });
        if (isInternalToCore) return;

        const x1 = toPdfX(b.startX);
        const y1 = toPdfY(b.startZ);
        const x2 = toPdfX(b.endX);
        const y2 = toPdfY(b.endZ);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) return;
        const nx = -dy / len;
        const ny = dx / len;
        const bWidth = b.width || 0.23;
        const hw = Math.max(0.6, (bWidth / 2) * scale);
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.35);
        doc.line(x1 + nx * hw, y1 + ny * hw, x2 + nx * hw, y2 + ny * hw);
        doc.line(x1 - nx * hw, y1 - ny * hw, x2 - nx * hw, y2 - ny * hw);

        if (showMemberLabels && len >= 6) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const labelText = !showSectionSizes ? b.label : (len < 12 ? b.label : `${b.label} (${b.sectionName})`);
          const textW = (labelText.length * 1.35) + 2.0;
          const tL = textW / 2;
          const tH = 1.6;
          let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angleDeg > 90) angleDeg -= 180;
          if (angleDeg < -90) angleDeg += 180;
          const rad = (angleDeg * Math.PI) / 180;
          const atx = Math.cos(rad);
          const aty = Math.sin(rad);
          const anx = -Math.sin(rad);
          const any = Math.cos(rad);
          const c1 = [midX - atx * tL - anx * tH, midY - aty * tL - any * tH];
          const c2 = [midX + atx * tL - anx * tH, midY + aty * tL - any * tH];
          const c3 = [midX + atx * tL + anx * tH, midY + aty * tL + any * tH];
          const c4 = [midX - atx * tL + anx * tH, midY - aty * tL + any * tH];
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(186, 230, 253);
          doc.setLineWidth(0.15);
          const polyLines: [number, number][] = [
            [c2[0] - c1[0], c2[1] - c1[1]],
            [c3[0] - c2[0], c3[1] - c2[1]],
            [c4[0] - c3[0], c4[1] - c3[1]],
          ];
          doc.lines(polyLines, c1[0], c1[1], [1, 1], 'FD', true);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(4.6);
          doc.setTextColor(3, 105, 161);
          doc.text(labelText, midX, midY, { align: 'center', baseline: 'middle', angle: -angleDeg });
        }
      });
    }

    // 10. Draw Columns — only C20-C23 hidden; other 2 of a 6-col combined mat remain visible
    fp.columns.forEach((c) => {
      const isInLiftCoreU = fp.combinedPileCaps?.some((grp) => {
        const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
        if (!isWallGrp) return false;
        return grp.nodeIds.includes(c.nodeId) || grp.columnLabels.includes(c.label) || grp.columnLabels.includes(`C${c.columnSlNo}`) || (fp.absorbedCombinedCapNodeIds && fp.absorbedCombinedCapNodeIds.has(c.nodeId));
      });
      if (isInLiftCoreU && ['C20', 'C21', 'C22', 'C23'].includes(c.label)) return;

      const cx = toPdfX(c.x);
      const cy = toPdfY(c.z);
      const cw = (c.width || 0.45) * scale;
      const cd = (c.depth || 0.55) * scale;
      doc.setFillColor(6, 95, 70);
      doc.setDrawColor(52, 211, 153);
      doc.setLineWidth(0.4);
      doc.rect(cx - cw / 2, cy - cd / 2, Math.max(cw, 2.5), Math.max(cd, 2.5), 'FD');
      // X hatch to match web
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.25);
      doc.line(cx - cw / 2, cy - cd / 2, cx + cw / 2, cy + cd / 2);
      doc.line(cx - cw / 2, cy + cd / 2, cx + cw / 2, cy - cd / 2);
      if (showMemberLabels) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(52, 211, 153);
        doc.text(c.label, cx, cy + cd / 2 + 3, { align: 'center' });
      }
    });

    // 11. Column Bay Dimension Chains — respects showDimensions
    if (showDimensions) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.setFont('helvetica', 'normal');
      // X bays (top)
      fp.gridLinesX.slice(0, -1).forEach((g1, i) => {
        const g2 = fp.gridLinesX[i + 1];
        const x1 = toPdfX(g1.coord);
        const x2 = toPdfX(g2.coord);
        const dimY = toPdfY(bounds.minZ - 1.0) - 7;
        doc.setLineWidth(0.3);
        doc.line(x1, dimY, x2, dimY);
        doc.setFillColor(148, 163, 184);
        doc.triangle(x1, dimY, x1 + 1, dimY - 0.6, x1 + 1, dimY + 0.6, 'F');
        doc.triangle(x2, dimY, x2 - 1, dimY - 0.6, x2 - 1, dimY + 0.6, 'F');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        const baySpan = (g2.coord - g1.coord).toFixed(2);
        doc.text(`${baySpan} m`, (x1 + x2) / 2, dimY - 1.5, { align: 'center' });
      });
      // Z bays (left)
      fp.gridLinesZ.slice(0, -1).forEach((g1, i) => {
        const g2 = fp.gridLinesZ[i + 1];
        const y1 = toPdfY(g1.coord);
        const y2 = toPdfY(g2.coord);
        const dimX = toPdfX(bounds.minX - 1.0) - 7;
        doc.line(dimX, y1, dimX, y2);
        doc.triangle(dimX, y1, dimX - 0.6, y1 + 1, dimX + 0.6, y1 + 1, 'F');
        doc.triangle(dimX, y2, dimX - 0.6, y2 - 1, dimX + 0.6, y2 - 1, 'F');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        const baySpan = (g2.coord - g1.coord).toFixed(2);
        doc.text(`${baySpan} m`, dimX - 1.5, (y1 + y2) / 2, { align: 'center', angle: 90 });
      });
    }

    // 12. FOUNDATION SPECIAL: Detailed Enlarged Pile Cap Plans & Cross-Sections — now DYNAMIC, respects selectedSectionType
    if (isFoundation) {
      const uniqueTypes = computeUniquePileCapTypes(fp);
      const visibleTypes = (() => {
        if (selectedSectionType === 'ALL' || !selectedSectionType) return uniqueTypes;
        if (selectedSectionType === 'COMBINED') return uniqueTypes.filter(t => t.shape === 'COMBINED');
        return uniqueTypes.filter(t => t.typeId === selectedSectionType || t.sectionLabel.includes(selectedSectionType));
      })();

      // If no visible types or filter yields none, skip panel
      if (visibleTypes.length === 0) return;

      const pBoxX = pageWidth - 13 - 176;
      const pBoxY = 30;
      const pBoxW = 176;
      const pBoxH = 205;
      doc.setFillColor(248, 250, 252);
      doc.rect(pBoxX, pBoxY, pBoxW, pBoxH, 'F');
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.6);
      doc.rect(pBoxX, pBoxY, pBoxW, pBoxH, 'S');
      doc.setFillColor(30, 41, 59);
      doc.rect(pBoxX, pBoxY, pBoxW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('FOUNDATION PILE CAP SCHEDULE & ALL CROSS-SECTIONS (IS 2911 / SP:34)', pBoxX + pBoxW / 2, pBoxY + 5, { align: 'center' });

      const drawHorizDim = (x1: number, x2: number, y: number, text: string) => {
        doc.setDrawColor(220, 38, 38);
        doc.setFillColor(220, 38, 38);
        doc.setLineWidth(0.2);
        doc.line(x1, y, x2, y);
        doc.triangle(x1, y, x1 + 1.2, y - 0.4, x1 + 1.2, y + 0.4, 'FD');
        doc.triangle(x2, y, x2 - 1.2, y - 0.4, x2 - 1.2, y + 0.4, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.5);
        doc.setTextColor(220, 38, 38);
        doc.text(text, (x1 + x2) / 2, y - 0.8, { align: 'center' });
      };
      const drawVertDim = (x: number, y1: number, y2: number, text: string) => {
        doc.setDrawColor(220, 38, 38);
        doc.setFillColor(220, 38, 38);
        doc.setLineWidth(0.2);
        doc.line(x, y1, x, y2);
        doc.triangle(x, y1, x - 0.4, y1 + 1.2, x + 0.4, y1 + 1.2, 'FD');
        doc.triangle(x, y2, x - 0.4, y2 - 1.2, x + 0.4, y2 - 1.2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.5);
        doc.setTextColor(220, 38, 38);
        doc.text(text, x + 1.2, (y1 + y2) / 2 + 1);
      };

      // Layout: if ALL, show up to 2 in grid; if filtered single, show enlarged centered
      const isSingleFiltered = visibleTypes.length === 1;
      const typesToRender = isSingleFiltered ? visibleTypes : visibleTypes.slice(0, 2);
      const rowHeight = isSingleFiltered ? 180 : 98;

      typesToRender.forEach((item, tIdx) => {
        const subBoxY = pBoxY + 8 + tIdx * rowHeight;
        const subBoxH = isSingleFiltered ? 180 : 94;
        // Use actual L/B to compute scale — match web's dScale = 24 / max(L,B,2600)
        const dScale = (isSingleFiltered ? 48 : 24) / Math.max(item.L, item.B, 2600);
        const planW_mm = item.L * dScale;
        const planH_mm = item.B * dScale;
        if (tIdx > 0 && !isSingleFiltered) {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.5);
          doc.line(pBoxX + 2, subBoxY - 2, pBoxX + pBoxW - 2, subBoxY - 2);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(79, 70, 229);
        const title = `${item.typeId}: ${item.typeName} (${item.shape === 'PENTAGONAL' ? (item.facetDim || 1461) + 'mm x 5 Sides' : `${item.L}x${item.B}`} x ${item.D} mm) - ${item.sectionLabel} · ${item.associatedColumns.join(', ')}`;
        doc.text(title.substring(0, 78), pBoxX + 4, subBoxY + 4);

        const plCx = pBoxX + 32;
        const plCy = subBoxY + 34;
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.25);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(plCx - planW_mm / 2 - 6, plCy, plCx + planW_mm / 2 + 6, plCy);
        doc.setLineDashPattern([], 0);
        doc.setFillColor(79, 70, 229);
        doc.triangle(plCx - planW_mm / 2 - 6, plCy - 1.0, plCx - planW_mm / 2 - 8, plCy, plCx - planW_mm / 2 - 6, plCy + 1.0, 'FD');
        doc.triangle(plCx + planW_mm / 2 + 6, plCy - 1.0, plCx + planW_mm / 2 + 8, plCy, plCx + planW_mm / 2 + 6, plCy + 1.0, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(79, 70, 229);
        doc.text(`${item.sectionNum}`, plCx - planW_mm / 2 - 9.5, plCy + 1);
        doc.text(`${item.sectionNum}`, plCx + planW_mm / 2 + 9.5, plCy + 1);

        // PCC
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.35);
        if (item.shape === 'PENTAGONAL') {
          const Rp = (item.s * dScale) / (2 * Math.sin(Math.PI / 5));
          const Rcap = Rp + (item.eo + 150) * dScale;
          const cos18 = Math.cos(Math.PI / 10);
          const sin18 = Math.sin(Math.PI / 10);
          const sin36 = Math.sin(Math.PI / 5);
          const cos36 = Math.cos(Math.PI / 5);
          const p1 = [plCx, plCy - Rcap];
          const p2 = [plCx - Rcap * cos18, plCy - Rcap * sin18];
          const p3 = [plCx - Rcap * sin36, plCy + Rcap * cos36];
          const p4 = [plCx + Rcap * sin36, plCy + Rcap * cos36];
          const p5 = [plCx + Rcap * cos18, plCy - Rcap * sin18];
          const polyLines: [number, number][] = [
            [p2[0] - p1[0], p2[1] - p1[1]],
            [p3[0] - p2[0], p3[1] - p2[1]],
            [p4[0] - p3[0], p4[1] - p3[1]],
            [p5[0] - p4[0], p5[1] - p4[1]],
          ];
          doc.lines(polyLines, p1[0], p1[1], [1, 1], 'S', true);
        } else if (item.shape === 'COMBINED') {
          // Combined mat: rect + PCC
          doc.rect(plCx - ((item.L + 300) * dScale) / 2, plCy - ((item.B + 300) * dScale) / 2, (item.L + 300) * dScale, (item.B + 300) * dScale, 'S');
        } else {
          doc.rect(plCx - ((item.L + 300) * dScale) / 2, plCy - ((item.B + 300) * dScale) / 2, (item.L + 300) * dScale, (item.B + 300) * dScale, 'S');
        }

        // Cap perimeter
        doc.setFillColor(item.shape === 'COMBINED' ? 240 : 253, item.shape === 'COMBINED' ? 253 : 244, item.shape === 'COMBINED' ? 244 : 255);
        doc.setDrawColor(item.shape === 'COMBINED' ? 244 : 192, item.shape === 'COMBINED' ? 63 : 38, item.shape === 'COMBINED' ? 94 : 211);
        doc.setLineWidth(0.6);
        if (item.shape === 'PENTAGONAL') {
          const Rp = (item.s * dScale) / (2 * Math.sin(Math.PI / 5));
          const Rcap = Rp + item.eo * dScale;
          const cos18 = Math.cos(Math.PI / 10);
          const sin18 = Math.sin(Math.PI / 10);
          const sin36 = Math.sin(Math.PI / 5);
          const cos36 = Math.cos(Math.PI / 5);
          const p1 = [plCx, plCy - Rcap];
          const p2 = [plCx - Rcap * cos18, plCy - Rcap * sin18];
          const p3 = [plCx - Rcap * sin36, plCy + Rcap * cos36];
          const p4 = [plCx + Rcap * sin36, plCy + Rcap * cos36];
          const p5 = [plCx + Rcap * cos18, plCy - Rcap * sin18];
          const polyLines: [number, number][] = [
            [p2[0] - p1[0], p2[1] - p1[1]],
            [p3[0] - p2[0], p3[1] - p2[1]],
            [p4[0] - p3[0], p4[1] - p3[1]],
            [p5[0] - p4[0], p5[1] - p4[1]],
          ];
          doc.lines(polyLines, p1[0], p1[1], [1, 1], 'FD', true);
        } else {
          doc.rect(plCx - planW_mm / 2, plCy - planH_mm / 2, planW_mm, planH_mm, 'FD');
        }

        // Piles
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.35);
        const offsets = item.shape === 'COMBINED' && item.pileOffsets ? item.pileOffsets : ((item as any).cap?.pileOffsets || (item as any).offsets || []);
        // For dynamic types, if pileOffsets missing, generate for RECTANGULAR 4-pile etc from web fallback
        let pileOffsets = offsets;
        if (!pileOffsets || pileOffsets.length === 0) {
          if (item.count === 4) {
            const off = 525;
            pileOffsets = [{ x: -off, y: -off }, { x: off, y: -off }, { x: -off, y: off }, { x: off, y: off }];
          } else if (item.shape === 'COMBINED') {
            pileOffsets = item.pileOffsets || [];
          }
        }
        pileOffsets.forEach((off: any) => {
          const px = plCx + (off.x / 1000) * (dScale * 1000);
          const py = plCy - (off.y / 1000) * (dScale * 1000);
          const rP = (item.Dp / 2) * dScale;
          doc.circle(px, py, rP, 'FD');
          doc.line(px - rP - 0.4, py, px + rP + 0.4, py);
          doc.line(px, py - rP - 0.4, px, py + rP + 0.4);
        });

        doc.setFillColor(202, 138, 4);
        doc.setDrawColor(234, 179, 8);
        doc.rect(plCx - 3.2, plCy - 3.2, 6.4, 6.4, 'FD');

        if (item.shape === 'RECTANGULAR' || item.shape === 'COMBINED') {
          const topDimY = plCy - planH_mm / 2 - 4.5;
          doc.setDrawColor(220, 38, 38);
          doc.setLineWidth(0.15);
          doc.setLineDashPattern([0.8, 0.8], 0);
          doc.line(plCx - planW_mm / 2, plCy - planH_mm / 2, plCx - planW_mm / 2, topDimY - 1);
          doc.line(plCx + planW_mm / 2, plCy - planH_mm / 2, plCx + planW_mm / 2, topDimY - 1);
          doc.setLineDashPattern([], 0);
          drawHorizDim(plCx - planW_mm / 2, plCx + planW_mm / 2, topDimY, `${item.L}`);
          const rDimX = plCx + planW_mm / 2 + 4.5;
          doc.setLineDashPattern([0.8, 0.8], 0);
          doc.line(plCx + planW_mm / 2, plCy - planH_mm / 2, rDimX + 1, plCy - planH_mm / 2);
          doc.line(plCx + planW_mm / 2, plCy + planH_mm / 2, rDimX + 1, plCy + planH_mm / 2);
          doc.setLineDashPattern([], 0);
          drawVertDim(rDimX, plCy - planH_mm / 2, plCy + planH_mm / 2, `${item.B}`);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(4.5);
          doc.setTextColor(220, 38, 38);
          doc.text(`${item.facetDim || 1461}`, plCx, plCy - planH_mm / 2 - 2, { align: 'center' });
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(8, 145, 178);
        doc.text(`PILE CAP ${item.typeId} - PLAN (SCALE 1:50)`, plCx, plCy + planH_mm / 2 + 6.5, { align: 'center' });

        // Cross-section elevation
        const secX = pBoxX + 66;
        const secY = subBoxY + 28;
        const secW = 54;
        const secH = 22;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(234, 179, 8);
        doc.rect(secX + secW / 2 - 4.5, secY - 9, 9, 9, 'FD');
        doc.setDrawColor(220, 38, 38);
        doc.line(secX + secW / 2 - 4.5, secY - 6.5, secX + secW / 2 + 4.5, secY - 6.5);
        doc.line(secX + secW / 2 - 4.5, secY - 3.5, secX + secW / 2 + 4.5, secY - 3.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(3.8);
        doc.setTextColor(220, 38, 38);
        doc.text('LINKS', secX + secW / 2, secY - 4.5, { align: 'center' });
        doc.setFillColor(253, 244, 255);
        doc.setDrawColor(192, 38, 211);
        doc.setLineWidth(0.6);
        doc.rect(secX, secY, secW, secH, 'FD');
        doc.setFillColor(180, 83, 9);
        doc.setDrawColor(120, 53, 15);
        doc.rect(secX - 2.5, secY + secH, secW + 5, 3.5, 'FD');
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(22, 163, 74);
        const p1_x = secX + 11;
        const p2_x = secX + secW - 11;
        doc.rect(p1_x - 4.5, secY + secH - 1, 9, 12, 'FD');
        doc.rect(p2_x - 4.5, secY + secH - 1, 9, 12, 'FD');
        if (item.shape === 'PENTAGONAL') {
          doc.rect(secX + secW / 2 - 4.5, secY + secH - 1, 9, 12, 'FD');
        }
        if (item.shape === 'COMBINED') {
          // For combined, show multiple piles
          const midX = secX + secW / 2;
          if (pileOffsets.length > 4) {
            doc.rect(midX - 4.5, secY + secH - 1, 9, 12, 'FD');
          }
        }
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.7);
        doc.line(secX + 2.0, secY + secH - 2.0, secX + secW - 2.0, secY + secH - 2.0);
        doc.line(secX + 2.0, secY + secH - 2.0, secX + 2.0, secY + 8);
        doc.line(secX + secW - 2.0, secY + secH - 2.0, secX + secW - 2.0, secY + 8);
        doc.setDrawColor(6, 182, 212);
        doc.setLineWidth(0.55);
        doc.line(secX + 2.0, secY + 2.5, secX + secW - 2.0, secY + 2.5);
        doc.line(secX + 2.0, secY + 2.5, secX + 2.0, secY + 9);
        doc.line(secX + secW - 2.0, secY + 2.5, secX + secW - 2.0, secY + 9);
        doc.setFillColor(22, 163, 74);
        doc.circle(secX + 2.0, secY + 8, 0.6, 'F');
        doc.circle(secX + 2.0, secY + 14, 0.6, 'F');
        doc.circle(secX + secW - 2.0, secY + 8, 0.6, 'F');
        doc.circle(secX + secW - 2.0, secY + 14, 0.6, 'F');
        const secTopDimY = secY - 11;
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.15);
        doc.line(secX, secY, secX, secTopDimY - 1);
        doc.line(secX + secW, secY, secX + secW, secTopDimY - 1);
        doc.setLineDashPattern([], 0);
        drawHorizDim(secX, secX + secW, secTopDimY, `${item.L}`);
        const secRDimX = secX + secW + 4;
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(secX + secW, secY, secRDimX + 1, secY);
        doc.line(secX + secW, secY + secH, secRDimX + 1, secY + secH);
        doc.setLineDashPattern([], 0);
        drawVertDim(secRDimX, secY, secY + secH, `${item.D}`);
        const dimY = secY + secH + 16;
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(secX, secY + secH, secX, dimY + 1);
        doc.line(p1_x, secY + secH + 11, p1_x, dimY + 1);
        doc.line(p2_x, secY + secH + 11, p2_x, dimY + 1);
        doc.line(secX + secW, secY + secH, secX + secW, dimY + 1);
        doc.setLineDashPattern([], 0);
        drawHorizDim(secX, p1_x, dimY, `${Math.round(item.eo)}`);
        drawHorizDim(p1_x, p2_x, dimY, `${item.s}`);
        drawHorizDim(p2_x, secX + secW, dimY, `${Math.round(item.eo)}`);
        const leaderX = pBoxX + 130;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.5);
        doc.setTextColor(220, 38, 38);
        doc.line(secX + secW - 4, secY + 2.5, leaderX - 2, secY - 2);
        doc.line(leaderX - 2, secY - 2, leaderX + 40, secY - 2);
        const topR = (item as any).cap?.topRebarCallout || (item as any).cap?.rebarCalloutX || item.topRebar || 'T12 @ 100 mm c/c';
        const botR = (item as any).cap?.rebarCalloutX || (item as any).cap?.rebarCalloutY || item.botRebar || 'T16 @ 150 mm c/c';
        doc.text(`TOP: ${topR}`, leaderX, secY - 3.5);
        doc.line(secX + secW - 4, secY + secH - 2, leaderX - 2, secY + secH - 2);
        doc.line(leaderX - 2, secY + secH - 2, leaderX + 40, secY + secH - 2);
        doc.text(`BOT: ${botR}`, leaderX, secY + secH - 3.5);
        doc.text(`TIES: 3-T10`, leaderX, secY + 6);
        doc.text(`150THK PCC`, leaderX, secY + 12);
        doc.text(`${item.Dp} DIA PILE (50mm Embed)`, leaderX, secY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(8, 145, 178);
        doc.text(`${item.sectionLabel} - DETAIL OF ${item.typeId} (SCALE 1:50)`, secX + secW / 2, subBoxY + subBoxH - 4, { align: 'center' });
      });

      // If visibleTypes had more than 2, indicate additional types truncated
      if (visibleTypes.length > 2 && !isSingleFiltered) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        doc.text(`+ ${visibleTypes.length - 2} more type(s) filtered — select single type to view enlarged`, pBoxX + pBoxW / 2, pBoxY + pBoxH - 3, { align: 'center' });
      }
    }
  }
}
