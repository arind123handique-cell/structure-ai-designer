import { describe, it, expect } from 'vitest';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';

describe('IS 13920:2016 Weak Beam - Strong Column (WBSC) Engine', () => {
  it('should verify joint WBSC ratio sum(Mc) >= 1.4 sum(Mb)', () => {
    // Joint with strong columns (2 x 180 kNm = 360 kNm) and moderate beams (2 x 100 kNm = 200 kNm)
    // ratio = 360 / 200 = 1.80 >= 1.40 -> PASS
    const result = IS13920WeakBeamStrongColumn.checkJoint({
      jointNodeId: 10,
      columnsAboveAndBelow: [
        { memberId: 1, b: 450, D: 550, fck: 25, fy: 500, Pu: 800, Mu_capacity: 180 },
        { memberId: 2, b: 450, D: 550, fck: 25, fy: 500, Pu: 800, Mu_capacity: 180 },
      ],
      beamsFramingIn: [
        { memberId: 3, b: 300, D: 450, fck: 25, fy: 500, Mu_capacity: 100 },
        { memberId: 4, b: 300, D: 450, fck: 25, fy: 500, Mu_capacity: 100 },
      ],
    });

    expect(result.isCompliant).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.ratio).toBe(1.8);
  });

  it('should flag weak column and recommend beam downsizing for economical optimization', () => {
    // Joint with weak columns (2 x 90 kNm = 180 kNm) and oversized beams (2 x 150 kNm = 300 kNm)
    // ratio = 180 / 300 = 0.60 < 1.40 -> FAIL
    const result = IS13920WeakBeamStrongColumn.checkJoint({
      jointNodeId: 15,
      columnsAboveAndBelow: [
        { memberId: 1, b: 300, D: 450, fck: 25, fy: 500, Pu: 600, Mu_capacity: 90 },
        { memberId: 2, b: 300, D: 450, fck: 25, fy: 500, Pu: 600, Mu_capacity: 90 },
      ],
      beamsFramingIn: [
        { memberId: 3, b: 300, D: 600, fck: 25, fy: 500, Mu_capacity: 150 },
        { memberId: 4, b: 300, D: 600, fck: 25, fy: 500, Mu_capacity: 150 },
      ],
    });

    expect(result.isCompliant).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.recommendation.type).toBe('DOWNSIZE_BEAMS');
    expect(result.recommendation.recommendedBeamDepth).toBeLessThanOrEqual(500);
  });

  it('should evaluate WBSC for single column correctly', () => {
    const colCheck = IS13920WeakBeamStrongColumn.evaluateForColumn(450, 550, 25, 500, 850, 300, 450);
    expect(colCheck.ratio).toBeGreaterThan(1.0);
    expect(colCheck.suggestion.length).toBeGreaterThan(10);
  });
});
