import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeThreeObject } from '@/utils/memoryManager';
import { createReinforcementShared, disposeReinforcementShared } from '@/components/model-viewer/Reinforcement3DRenderer';

describe('Three.js 3D Viewport Lightweight Memory Optimization', () => {
  describe('disposeThreeObject preservation of isShared assets', () => {
    it('disposes non-shared geometries and materials while preserving isShared ones', () => {
      const group = new THREE.Group();

      // Shared geometry and material (used across all members)
      const sharedGeom = new THREE.BoxGeometry(1, 1, 1);
      sharedGeom.userData = { isShared: true };
      const sharedGeomDisposeSpy = vi.spyOn(sharedGeom, 'dispose');

      const sharedMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
      sharedMat.userData = { isShared: true };
      const sharedMatDisposeSpy = vi.spyOn(sharedMat, 'dispose');

      const sharedMesh = new THREE.Mesh(sharedGeom, sharedMat);
      group.add(sharedMesh);

      // Temporary/unique geometry and material (e.g. custom plate or extrude)
      const tempGeom = new THREE.BufferGeometry();
      const tempGeomDisposeSpy = vi.spyOn(tempGeom, 'dispose');

      const tempMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const tempMatDisposeSpy = vi.spyOn(tempMat, 'dispose');

      const tempMesh = new THREE.Mesh(tempGeom, tempMat);
      group.add(tempMesh);

      // Run deep disposal
      disposeThreeObject(group);

      // Shared resources MUST survive
      expect(sharedGeomDisposeSpy).not.toHaveBeenCalled();
      expect(sharedMatDisposeSpy).not.toHaveBeenCalled();

      // Temporary non-shared resources MUST be disposed to free memory
      expect(tempGeomDisposeSpy).toHaveBeenCalledOnce();
      expect(tempMatDisposeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Scaled Unit Geometries Dimensional Parity', () => {
    it('unitBox with scale.set(b, distance, D) produces identical bounding box to dedicated BoxGeometry', () => {
      const b = 0.35;
      const distance = 4.2;
      const D = 0.55;

      // 1. Dedicated box geometry (old heavy approach)
      const dedicatedGeom = new THREE.BoxGeometry(b, distance, D);
      const dedicatedMesh = new THREE.Mesh(dedicatedGeom, new THREE.MeshBasicMaterial());
      dedicatedMesh.position.set(2, 3, 4);
      dedicatedMesh.updateMatrixWorld(true);

      const dedicatedBox = new THREE.Box3().setFromObject(dedicatedMesh);

      // 2. Unit box geometry with scale (new lightweight approach)
      const unitGeom = new THREE.BoxGeometry(1, 1, 1);
      const scaledMesh = new THREE.Mesh(unitGeom, new THREE.MeshBasicMaterial());
      scaledMesh.scale.set(b, distance, D);
      scaledMesh.position.set(2, 3, 4);
      scaledMesh.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(scaledMesh);

      // Verify exact dimensional match
      expect(scaledBox.min.x).toBeCloseTo(dedicatedBox.min.x, 4);
      expect(scaledBox.max.x).toBeCloseTo(dedicatedBox.max.x, 4);
      expect(scaledBox.min.y).toBeCloseTo(dedicatedBox.min.y, 4);
      expect(scaledBox.max.y).toBeCloseTo(dedicatedBox.max.y, 4);
      expect(scaledBox.min.z).toBeCloseTo(dedicatedBox.min.z, 4);
      expect(scaledBox.max.z).toBeCloseTo(dedicatedBox.max.z, 4);

      // Cleanup
      dedicatedGeom.dispose();
      unitGeom.dispose();
    });

    it('unitBox correctly intersects Three.js Raycaster with scaled dimensions', () => {
      const unitGeom = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(unitGeom, new THREE.MeshBasicMaterial());
      mesh.scale.set(0.4, 3.0, 0.4);
      mesh.position.set(0, 1.5, 0);
      mesh.updateMatrixWorld(true);

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(5, 1.5, 0),
        new THREE.Vector3(-1, 0, 0)
      );

      const intersects = raycaster.intersectObject(mesh);
      expect(intersects.length).toBeGreaterThan(0);
      expect(intersects[0].point.x).toBeCloseTo(0.2, 4); // Half of width 0.4
      expect(intersects[0].point.y).toBeCloseTo(1.5, 4);
      expect(intersects[0].point.z).toBeCloseTo(0, 4);

      unitGeom.dispose();
    });
  });

  describe('3D Rebar Renderer Shared Unit Ring Geometry', () => {
    it('creates unitRingGeom with isShared: true and disposes cleanly', () => {
      const shared = createReinforcementShared(0.012);
      expect(shared.unitRingGeom).toBeDefined();
      expect(shared.unitRingGeom.userData?.isShared).toBe(true);
      expect(shared.barGeom.userData?.isShared).toBe(true);

      const ringDisposeSpy = vi.spyOn(shared.unitRingGeom, 'dispose');
      const barDisposeSpy = vi.spyOn(shared.barGeom, 'dispose');
      const matDisposeSpy = vi.spyOn(shared.barMat, 'dispose');

      disposeReinforcementShared(shared);

      expect(ringDisposeSpy).toHaveBeenCalledOnce();
      expect(barDisposeSpy).toHaveBeenCalledOnce();
      expect(matDisposeSpy).toHaveBeenCalledOnce();
    });

    it('scales unitRingGeom to exact column tie dimensions', () => {
      const shared = createReinforcementShared(0.01);
      const line = new THREE.Line(shared.unitRingGeom, shared.tieMat);

      const hw = 0.15; // half width (300mm wide column)
      const hd = 0.25; // half depth (500mm deep column)
      line.scale.set(hw * 2, 1, hd * 2);
      line.position.set(0, 2.0, 0);
      line.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(line);
      expect(box.min.x).toBeCloseTo(-0.15, 4);
      expect(box.max.x).toBeCloseTo(0.15, 4);
      expect(box.min.z).toBeCloseTo(-0.25, 4);
      expect(box.max.z).toBeCloseTo(0.25, 4);
      expect(box.min.y).toBeCloseTo(2.0, 4);
      expect(box.max.y).toBeCloseTo(2.0, 4);

      disposeReinforcementShared(shared);
    });
  });
});
