import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createReinforcementShared,
  disposeReinforcementShared,
  buildMemberReinforcement,
  ReinforcementSpec,
} from '@/components/model-viewer/Reinforcement3DRenderer';

describe('InstancedMesh Reinforcement Optimization', () => {
  it('builds column rebar using a single InstancedMesh for bars and single LineSegments for ties', () => {
    const shared = createReinforcementShared(0.012);

    const spec: ReinforcementSpec = {
      memberId: 101,
      isColumn: true,
      b: 0.45,
      D: 0.6,
      length: 3.2,
      coverMm: 40,
      columnRebar: {
        cornerBars: { diameter: 20, count: 4 },
        faceBars: { countX: 2, countY: 2 },
      },
    };

    const group = buildMemberReinforcement(
      spec,
      {
        showColumnBars: true,
        showColumnTies: true,
        showBeamBars: false,
        showBeamStirrups: false,
      },
      shared
    );

    expect(group).not.toBeNull();
    if (!group) return;

    // Must tag group and children with memberId
    expect(group.userData.memberId).toBe(101);
    expect(group.userData.rfType).toBe('rebar');

    // Should have 1 InstancedMesh for bars and 1 LineSegments for ties (total 2 children)
    // instead of 12 separate Mesh objects + 16 separate Line objects!
    expect(group.children.length).toBe(2);

    const instancedBars = group.children.find((c) => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const tieSegments = group.children.find((c) => c instanceof THREE.LineSegments) as THREE.LineSegments;

    expect(instancedBars).toBeDefined();
    expect(tieSegments).toBeDefined();

    // 4 corner bars + 2*2 face bars along D + 2*2 face bars along b = 12 bars total
    expect(instancedBars.count).toBe(12);

    // Verify tieSegments geometry has vertex buffer
    const posAttr = tieSegments.geometry.getAttribute('position');
    expect(posAttr).toBeDefined();
    expect(posAttr.count).toBeGreaterThan(0);

    disposeReinforcementShared(shared);
    tieSegments.geometry.dispose();
  });

  it('builds beam rebar using a single InstancedMesh and single LineSegments', () => {
    const shared = createReinforcementShared(0.01);

    const spec: ReinforcementSpec = {
      memberId: 202,
      isColumn: false,
      b: 0.3,
      D: 0.45,
      length: 5.0,
      coverMm: 30,
      beamTopBars: [{ count: 3, diameter: 16 }],
      beamBottomBars: [{ count: 3, diameter: 16 }],
      stirrupSpacingMm: 150,
      stirrupDiameterMm: 8,
    };

    const group = buildMemberReinforcement(
      spec,
      {
        showColumnBars: false,
        showColumnTies: false,
        showBeamBars: true,
        showBeamStirrups: true,
      },
      shared
    );

    expect(group).not.toBeNull();
    if (!group) return;

    expect(group.userData.memberId).toBe(202);
    expect(group.children.length).toBe(2);

    const instancedBars = group.children.find((c) => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const stirrupSegments = group.children.find((c) => c instanceof THREE.LineSegments) as THREE.LineSegments;

    expect(instancedBars).toBeDefined();
    expect(stirrupSegments).toBeDefined();

    // 3 top + 3 bottom = 6 longitudinal bars
    expect(instancedBars.count).toBe(6);

    disposeReinforcementShared(shared);
    stirrupSegments.geometry.dispose();
  });
});
