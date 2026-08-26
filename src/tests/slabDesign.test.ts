import { describe, it, expect } from 'vitest';
import { SlabDesignEngine } from '@/features/design/slab/slabDesignEngine';

describe('SlabDesignEngine (IS 456:2000 & RCDC)', () => {
  it('should design a Two-Way Restrained Slab with IS 456 Table 26 coefficients', () => {
    const output = SlabDesignEngine.design({
      panelId: 'S1',
      floorLevel: '1ST FLOOR',
      lx: 3.5,
      ly: 4.5,
      boundaryCondition: 'TWO_ADJACENT_DISCONTINUOUS',
      liveLoad: 2.0,
      floorFinishLoad: 1.0,
      fck: 25,
      fy: 500,
    });

    expect(output.panelId).toBe('S1');
    expect(output.slabType).toBe('TWO_WAY_RESTRAINED');
    expect(output.aspectRatio).toBeCloseTo(4.5 / 3.5, 2);
    expect(output.thickness).toBeGreaterThanOrEqual(110);
    expect(output.Mux_pos).toBeGreaterThan(0);
    expect(output.Mux_neg).toBeGreaterThan(0);
    expect(output.botRebarXCallout).toContain('T10 @');
    expect(output.botRebarYCallout).toContain('T10 @');
    expect(output.torsionRebarCallout).toBeDefined();
    expect(output.deflectionCheck).toBe('PASS');
    expect(output.shearCheck).toBe('PASS');
    expect(output.status).toBe('PASS');
  });

  it('should design a One-Way Slab when aspect ratio Ly/Lx > 2.0', () => {
    const output = SlabDesignEngine.design({
      panelId: 'S2',
      floorLevel: '1ST FLOOR',
      lx: 2.5,
      ly: 6.0,
      boundaryCondition: 'ONE_WAY_CONTINUOUS',
      liveLoad: 2.5,
      fck: 25,
      fy: 500,
    });

    expect(output.slabType).toBe('ONE_WAY');
    expect(output.aspectRatio).toBe(2.4);
    expect(output.Mux_pos).toBeGreaterThan(0);
    expect(output.deflectionCheck).toBe('PASS');
    expect(output.status).toBe('PASS');
  });

  it('should design a Cantilever Slab with cantilever moment and 7 basic L/d ratio', () => {
    const output = SlabDesignEngine.design({
      panelId: 'S3',
      floorLevel: '1ST FLOOR',
      lx: 1.5,
      ly: 3.0,
      boundaryCondition: 'CANTILEVER',
      liveLoad: 3.0,
      fck: 25,
      fy: 500,
    });

    expect(output.slabType).toBe('CANTILEVER');
    expect(output.Mux_neg).toBeGreaterThan(0); // Cantilever top negative moment
    expect(output.deflectionRatioLimit).toBeGreaterThan(0);
    expect(output.status).toBe('PASS');
  });
});
