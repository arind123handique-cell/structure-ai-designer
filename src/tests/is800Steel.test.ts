import { describe, it, expect } from 'vitest';
import { DesignCodeRegistry } from '@/features/codes/designCodeRegistry';
import { SteelMemberEngine, SteelSectionProperties } from '@/features/codes/is800/steelMemberEngine';

describe('Modular Design Code Engine & IS 800:2007 Steel Design (Architecture Sections 18, 19, 22)', () => {
  const ismb300: SteelSectionProperties = {
    designation: 'ISMB 300',
    depthMm: 300,
    widthMm: 140,
    flangeThicknessMm: 12.4,
    webThicknessMm: 7.5,
    areaCm2: 56.26,
    izCm4: 8603.6,
    iyCm4: 453.9,
    rzCm: 12.37,
    ryCm: 2.84,
    zpzCm3: 651.7,
    zpyCm3: 98.4,
    zezCm3: 573.6,
    zeyCm3: 64.8,
  };

  it('correctly registers and queries multi-national structural design codes', () => {
    const is800 = DesignCodeRegistry.getCode('IS800_2007');
    expect(is800).toBeDefined();
    expect(is800?.materialType).toBe('STEEL');
    expect(is800?.supportedMembers).toContain('COLUMN');

    const concreteCodes = DesignCodeRegistry.getCodesByMaterial('CONCRETE');
    expect(concreteCodes.length).toBeGreaterThanOrEqual(3);
  });

  it('designs an ISMB 300 beam under flexure and shear conforming to IS 800:2007', () => {
    const result = SteelMemberEngine.designMember({
      memberId: 101,
      lengthM: 4.0,
      section: ismb300,
      fyMpa: 250,
      forces: {
        puKn: 0, // pure beam
        vuYKn: 65, // shear
        vuZKn: 0,
        muZKnm: 85, // major bending
        muYKnm: 0,
        governingLoadCaseId: 1,
      },
    });

    expect(result.capacities.momentCapacityZKnm).toBeGreaterThan(120); // Zpz * 250 / 1.10 ~ 148 kNm
    expect(result.capacities.shearCapacityYKn).toBeGreaterThan(250);
    expect(result.status).toBe('PASS');
    expect(result.utilizationRatio).toBeLessThan(1.0);
    expect(result.ratios.momentZRatio).toBeCloseTo(85 / result.capacities.momentCapacityZKnm, 2);
  });

  it('designs an ISMB 300 column under axial compression and slenderness buckling', () => {
    const result = SteelMemberEngine.designMember({
      memberId: 201,
      lengthM: 3.2,
      section: ismb300,
      fyMpa: 250,
      forces: {
        puKn: 450, // axial compression
        vuYKn: 15,
        vuZKn: 0,
        muZKnm: 25,
        muYKnm: 5,
        governingLoadCaseId: 2,
      },
    });

    expect(result.slendernessRatio).toBeLessThan(result.slendernessLimit);
    expect(result.capacities.axialCapacityKn).toBeGreaterThan(0);
    expect(result.ratios.axialRatio).toBeGreaterThan(0);
  });

  it('flags FAIL when demand exceeds IS 800 section capacity', () => {
    const failedResult = SteelMemberEngine.designMember({
      memberId: 999,
      lengthM: 5.0,
      section: ismb300,
      fyMpa: 250,
      forces: {
        puKn: 2500, // exceeds compressive capacity of ISMB 300
        vuYKn: 400,
        vuZKn: 0,
        muZKnm: 300,
        muYKnm: 50,
        governingLoadCaseId: 99,
      },
    });

    expect(failedResult.status).toBe('FAIL');
    expect(failedResult.utilizationRatio).toBeGreaterThan(1.0);
  });
});
