import { describe, it, expect } from 'vitest';
import { StaircaseDesignEngine } from '../features/design/staircase/staircaseEngine';
import { NormalizedStructuralModel } from '../features/model/types';

describe('StaircaseDesignEngine Unit & Integration Tests', () => {
  it('should generate default diaphragm levels when model is empty or null', () => {
    const levels = StaircaseDesignEngine.extractDiaphragmLevels(null);
    expect(levels).toBeDefined();
    expect(levels.length).toBeGreaterThanOrEqual(4);
    expect(levels[0].bottomElevationY).toBe(0.0);
    expect(levels[0].topElevationY).toBe(3.2);
    expect(levels[0].storeyHeightM).toBe(3.2);
    expect(levels[0].midLandingElevationY).toBe(1.6);
  });

  it('should extract diaphragm levels accurately from a normalized structural model', () => {
    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 4, y: 0, z: 0 }],
        [3, { id: 3, x: 0, y: 3.2, z: 0 }],
        [4, { id: 4, x: 4, y: 3.2, z: 0 }],
        [5, { id: 5, x: 0, y: 6.4, z: 0 }],
        [6, { id: 6, x: 4, y: 6.4, z: 0 }],
        [7, { id: 7, x: 0, y: 9.6, z: 0 }],
        [8, { id: 8, x: 4, y: 9.6, z: 0 }],
      ]),
      members: new Map([
        [1, { id: 1, startNodeId: 3, endNodeId: 4, length: 4, classification: 'BEAM', section: { name: '300x450', zd: 0.3, yd: 0.45 }, materialName: 'CONCRETE', isAutoClassified: true, designStatus: 'PASS' }],
        [2, { id: 2, startNodeId: 5, endNodeId: 6, length: 4, classification: 'BEAM', section: { name: '300x450', zd: 0.3, yd: 0.45 }, materialName: 'CONCRETE', isAutoClassified: true, designStatus: 'PASS' }],
        [3, { id: 3, startNodeId: 7, endNodeId: 8, length: 4, classification: 'BEAM', section: { name: '300x450', zd: 0.3, yd: 0.45 }, materialName: 'CONCRETE', isAutoClassified: true, designStatus: 'PASS' }],
      ]) as any,
    };

    const levels = StaircaseDesignEngine.extractDiaphragmLevels(mockModel as NormalizedStructuralModel);
    expect(levels.length).toBe(3);
    expect(levels[0].bottomElevationY).toBe(0);
    expect(levels[0].topElevationY).toBe(3.2);
    expect(levels[1].bottomElevationY).toBe(3.2);
    expect(levels[1].topElevationY).toBe(6.4);
    expect(levels[2].bottomElevationY).toBe(6.4);
    expect(levels[2].topElevationY).toBe(9.6);
  });

  it('should correctly design a flight under IS 456:2000 Cl. 33', () => {
    const diaphragm = {
      levelIndex: 1,
      levelName: 'Ground to 1st Floor Diaphragm',
      bottomElevationY: 0.0,
      topElevationY: 3.2,
      storeyHeightM: 3.2,
      midLandingElevationY: 1.6,
      isRoofLevel: false,
    };
    const geom = StaircaseDesignEngine.getDefaultGeometry();
    const entry = StaircaseDesignEngine.getDefaultLandingEntryConfig();

    const flight = StaircaseDesignEngine.designFlight(1, diaphragm, geom, entry);

    expect(flight.flightRiseM).toBe(1.6);
    expect(flight.riserCount).toBe(10);
    expect(flight.treadCount).toBe(9);
    expect(flight.goingLengthM).toBeCloseTo(9 * 0.275, 2);
    expect(flight.effectiveSpanLeffM).toBeGreaterThan(flight.goingLengthM);

    // Bending moment check
    expect(flight.designMomentMu).toBeGreaterThan(0);
    expect(flight.effectiveDepthD).toBeGreaterThan(flight.effectiveDepthReqMm);
    expect(flight.depthCheck).toBe('PASS');

    // Reinforcement checks
    expect(flight.mainAstProvided).toBeGreaterThanOrEqual(flight.mainAstRequired);
    expect(flight.mainRebarCallout).toContain('T12');
    expect(flight.distributionRebarCallout).toContain('T8');
    expect(flight.kinkAnchorageDetail).toContain('Cross-over kink tension bars');

    // Quantities
    expect(flight.concreteM3).toBeGreaterThan(0.5);
    expect(flight.formworkM2).toBeGreaterThan(2.0);
    expect(flight.steelKg).toBeGreaterThan(40);
    expect(flight.status).toBe('PASS');
  });

  it('should validate dual-side landing entry configuration and clearances', () => {
    const diaphragm = {
      levelIndex: 1,
      levelName: 'Ground to 1st Floor Diaphragm',
      bottomElevationY: 0.0,
      topElevationY: 3.2,
      storeyHeightM: 3.2,
      midLandingElevationY: 1.6,
      isRoofLevel: false,
    };
    const geom = StaircaseDesignEngine.getDefaultGeometry();
    const entry = StaircaseDesignEngine.getDefaultLandingEntryConfig();

    // Standard safe configuration
    const flightSafe = StaircaseDesignEngine.designFlight(1, diaphragm, geom, entry);
    expect(flightSafe.landingClearanceCheck).toBe('PASS');

    // Warning when door width exceeds landing depth
    const tightEntry = {
      ...entry,
      hasLeftDoor: true,
      leftDoorWidthM: 1.5, // 1.5m door > 1.2m landing
    };
    const flightTight = StaircaseDesignEngine.designFlight(1, diaphragm, geom, tightEntry);
    expect(flightTight.landingClearanceCheck).toBe('WARNING');
  });

  it('should generate complete building staircase summary and quantities', () => {
    const summary = StaircaseDesignEngine.calculateBuildingStaircaseSummary(null);

    expect(summary.totalStoreys).toBeGreaterThanOrEqual(4);
    expect(summary.totalFlights).toBe(summary.totalStoreys * 2);
    expect(summary.totalConcreteM3).toBeGreaterThan(5.0);
    expect(summary.totalFormworkM2).toBeGreaterThan(20.0);
    expect(summary.totalSteelKg).toBeGreaterThan(400);
    expect(summary.totalCementBags).toBeGreaterThan(40);
  });
});
