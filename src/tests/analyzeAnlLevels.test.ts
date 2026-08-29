import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { ANLParser } from '@/features/anl/anlParser';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { StaircaseDesignEngine } from '@/features/design/staircase/staircaseEngine';

describe('Analyze ANL Levels', () => {
  it('should analyze real floor levels and diaphragm levels in STR FINAL.anl', () => {
    if (!fs.existsSync('STR FINAL.anl')) {
      console.log('No STR FINAL.anl file found');
      return;
    }
    const anlContent = fs.readFileSync('STR FINAL.anl', 'utf8');
    const parsed = ANLParser.parse(anlContent);
    const model = parsed.model;
    console.log('\n--- PARSED MODEL STATS ---');
    console.log('Nodes count:', model.nodes.size);
    console.log('Members count:', model.members.size);
    console.log('Plates count:', model.plates.size);
    console.log('Supports count:', model.supports?.size || 0);

    // Inspect beam elevations and counts
    const beamsByY = new Map<number, number>();
    const colsByY = new Map<number, number>();
    for (const m of model.members.values()) {
      const n1 = model.nodes.get(m.startNodeId);
      const n2 = model.nodes.get(m.endNodeId);
      if (n1 && n2) {
        const dy = Math.abs(n1.y - n2.y);
        if (dy < 0.15) {
          const y = Math.round(n1.y * 100) / 100;
          beamsByY.set(y, (beamsByY.get(y) || 0) + 1);
        } else {
          const minY = Math.round(Math.min(n1.y, n2.y) * 100) / 100;
          const maxY = Math.round(Math.max(n1.y, n2.y) * 100) / 100;
          const key = `${minY}->${maxY}`;
          colsByY.set(key as any, (colsByY.get(key as any) || 0) + 1);
        }
      }
    }

    console.log('\n--- TRUE HORIZONTAL FRAMING BEAMS PER ELEVATION Y ---');
    for (const [y, count] of Array.from(beamsByY.entries()).sort((a,b) => a[0] - b[0])) {
      console.log(`  Y = ${y.toFixed(3)}m : ${count} horizontal members`);
    }

    // Test updated extraction algorithm
    function extractRobustLevels(model: any): number[] {
      const columnElevations = new Map<number, number>();
      for (const m of model.members.values()) {
        const n1 = model.nodes.get(m.startNodeId);
        const n2 = model.nodes.get(m.endNodeId);
        if (n1 && n2 && Math.abs(n1.y - n2.y) >= 0.5) {
          const y1 = Math.round(n1.y * 100) / 100;
          const y2 = Math.round(n2.y * 100) / 100;
          columnElevations.set(y1, (columnElevations.get(y1) || 0) + 1);
          columnElevations.set(y2, (columnElevations.get(y2) || 0) + 1);
        }
      }

      const beamElevations = new Map<number, number>();
      for (const m of model.members.values()) {
        const n1 = model.nodes.get(m.startNodeId);
        const n2 = model.nodes.get(m.endNodeId);
        if (n1 && n2 && Math.abs(n1.y - n2.y) < 0.15) {
          const y = Math.round(n1.y * 100) / 100;
          beamElevations.set(y, (beamElevations.get(y) || 0) + 1);
        }
      }

      const supportElevations = new Set<number>();
      if (model.supports) {
        for (const sup of model.supports) {
          const n = model.nodes.get(sup.nodeId);
          if (n) supportElevations.add(Math.round(n.y * 100) / 100);
        }
      }

      const candidateY = new Set<number>();
      for (const [y, colCount] of columnElevations.entries()) {
        if (colCount >= 2) candidateY.add(y);
      }
      for (const [y, beamCount] of beamElevations.entries()) {
        if (beamCount >= 3) candidateY.add(y);
      }
      for (const y of supportElevations) {
        candidateY.add(y);
      }

      // If nothing found, fallback to all node Y
      if (candidateY.size === 0) {
        for (const n of model.nodes.values()) candidateY.add(Math.round(n.y * 100) / 100);
      }

      const sortedCandidates = Array.from(candidateY).sort((a, b) => a - b);

      const primaryLevels: number[] = [];
      for (const y of sortedCandidates) {
        if (primaryLevels.length === 0) {
          primaryLevels.push(y);
        } else {
          const last = primaryLevels[primaryLevels.length - 1];
          if (Math.abs(y - last) > 0.35) {
            primaryLevels.push(y);
          }
        }
      }
      return primaryLevels;
    }

    const floorPlans = FloorPlanEngine.extractAllFloorPlans(model);
    console.log('\n--- FloorPlanEngine Extracted Floor Plans --- (' + floorPlans.length + ' levels)');
    for (const fp of floorPlans) {
      console.log(`Level ${fp.levelIndex} [${fp.levelName}]: Y = ${fp.elevationY.toFixed(3)}m | Beams = ${fp.beams.length} | Columns = ${fp.columns.length}`);
    }

    const diaphragmLevels = StaircaseDesignEngine.extractDiaphragmLevels(model);
    console.log('\n--- StaircaseDesignEngine Diaphragm Levels --- (' + diaphragmLevels.length + ' storeys)');
    for (const d of diaphragmLevels) {
      console.log(`Storey ${d.levelIndex} [${d.levelName}]: Bottom Y = ${d.bottomElevationY.toFixed(3)}m -> Top Y = ${d.topElevationY.toFixed(3)}m (Height = ${d.storeyHeightM.toFixed(3)}m, Mid = ${d.midLandingElevationY.toFixed(3)}m)`);
    }

    // Verify elevations
    expect(floorPlans.length).toBe(6);
    expect(floorPlans[0].elevationY).toBeCloseTo(0.0, 1);
    expect(floorPlans[1].elevationY).toBeCloseTo(3.2, 1);
    expect(floorPlans[2].elevationY).toBeCloseTo(6.4, 1);
    expect(floorPlans[3].elevationY).toBeCloseTo(9.6, 1);
    expect(floorPlans[4].elevationY).toBeCloseTo(12.8, 1);
    expect(floorPlans[5].elevationY).toBeCloseTo(15.65, 1);

    expect(diaphragmLevels.length).toBe(5);
    expect(diaphragmLevels[0].bottomElevationY).toBeCloseTo(0.0, 1);
    expect(diaphragmLevels[0].topElevationY).toBeCloseTo(3.2, 1);
    expect(diaphragmLevels[1].bottomElevationY).toBeCloseTo(3.2, 1);
    expect(diaphragmLevels[1].topElevationY).toBeCloseTo(6.4, 1);
    expect(diaphragmLevels[2].bottomElevationY).toBeCloseTo(6.4, 1);
    expect(diaphragmLevels[2].topElevationY).toBeCloseTo(9.6, 1);
    expect(diaphragmLevels[3].bottomElevationY).toBeCloseTo(9.6, 1);
    expect(diaphragmLevels[3].topElevationY).toBeCloseTo(12.8, 1);
  });
});
