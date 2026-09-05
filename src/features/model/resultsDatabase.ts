/**
 * STAAD.Pro Style Results Database (Architecture Section 23)
 * Provides an independent, query-only facade for analysis and design results.
 * Strictly enforces that the UI only queries results and does not compute engineering values.
 */

import {
  NormalizedStructuralModel,
  JointReaction,
  MemberForceRecord,
  StoryDriftRecord,
  MemberDesignSummary,
} from './types';

export interface NodeDisplacement6DOF {
  ux: number; // m
  uy: number; // m
  uz: number; // m
  rx: number; // rad
  ry: number; // rad
  rz: number; // rad
  resultantM: number;
}

export interface MemberForceEnvelope {
  maxAxialKn: number;
  minAxialKn: number;
  maxShearYKn: number;
  maxShearZKn: number;
  maxTorsionKnm: number;
  maxMomentYKnm: number;
  maxMomentZKnm: number;
  criticalLoadCaseId: number;
}

export class ResultsDatabase {
  constructor(private readonly model: NormalizedStructuralModel) {}

  /**
   * Returns 6-DOF joint displacement for a specific node and load case
   */
  public getNodeDisplacement(nodeId: number, loadCaseId: number): NodeDisplacement6DOF | null {
    if (!this.model.nodeDisplacements) return null;
    const nodeCases = this.model.nodeDisplacements.get(nodeId);
    if (!nodeCases) return null;
    const disp = nodeCases[loadCaseId];
    if (!disp) return null;

    const [ux, uy, uz, rx, ry, rz] = disp;
    return {
      ux,
      uy,
      uz,
      rx,
      ry,
      rz,
      resultantM: Math.sqrt(ux * ux + uy * uy + uz * uz),
    };
  }

  /**
   * Returns all internal forces recorded along a member (5 stations: 0, L/4, L/2, 3L/4, L)
   */
  public getMemberForces(memberId: number, loadCaseId?: number): MemberForceRecord[] {
    return this.model.memberForces.filter((mf) => {
      if (mf.memberId !== memberId) return false;
      if (loadCaseId !== undefined && mf.loadCaseId !== loadCaseId) return false;
      return true;
    });
  }

  /**
   * Returns min/max envelope forces for a member across all load combinations
   */
  public getMemberEnvelopeForces(memberId: number): MemberForceEnvelope | null {
    const forces = this.getMemberForces(memberId);
    if (forces.length === 0) return null;

    let maxAxial = -Infinity;
    let minAxial = Infinity;
    let maxVy = 0;
    let maxVz = 0;
    let maxT = 0;
    let maxMy = 0;
    let maxMz = 0;
    let critCase = forces[0].loadCaseId;

    for (const f of forces) {
      if (f.axial > maxAxial) maxAxial = f.axial;
      if (f.axial < minAxial) minAxial = f.axial;
      if (Math.abs(f.vy) > maxVy) maxVy = Math.abs(f.vy);
      if (Math.abs(f.vz) > maxVz) maxVz = Math.abs(f.vz);
      if (Math.abs(f.torsion) > maxT) maxT = Math.abs(f.torsion);
      if (Math.abs(f.my) > maxMy) maxMy = Math.abs(f.my);
      if (Math.abs(f.mz) > maxMz) {
        maxMz = Math.abs(f.mz);
        critCase = f.loadCaseId;
      }
    }

    return {
      maxAxialKn: maxAxial,
      minAxialKn: minAxial,
      maxShearYKn: maxVy,
      maxShearZKn: maxVz,
      maxTorsionKnm: maxT,
      maxMomentYKnm: maxMy,
      maxMomentZKnm: maxMz,
      criticalLoadCaseId: critCase,
    };
  }

  /**
   * Returns joint support reaction for a specific node and load case
   */
  public getJointReaction(nodeId: number, loadCaseId: number): JointReaction | null {
    return (
      this.model.reactions.find((r) => r.nodeId === nodeId && r.loadCaseId === loadCaseId) || null
    );
  }

  /**
   * Computes sum of support reactions for global static equilibrium verification
   */
  public getTotalReactions(loadCaseId: number): {
    totalFx: number;
    totalFy: number;
    totalFz: number;
    totalMx: number;
    totalMy: number;
    totalMz: number;
  } {
    let fx = 0, fy = 0, fz = 0, mx = 0, my = 0, mz = 0;
    for (const r of this.model.reactions) {
      if (r.loadCaseId === loadCaseId) {
        fx += r.fx;
        fy += r.fy;
        fz += r.fz;
        mx += r.mx;
        my += r.my;
        mz += r.mz;
      }
    }
    return { totalFx: fx, totalFy: fy, totalFz: fz, totalMx: mx, totalMy: my, totalMz: mz };
  }

  /**
   * Returns storey drift records per IS 1893:2016
   */
  public getStoryDrifts(loadCaseId?: number): StoryDriftRecord[] {
    if (loadCaseId === undefined) return this.model.storyDrifts;
    return this.model.storyDrifts.filter((sd) => sd.loadCaseId === loadCaseId);
  }

  /**
   * Returns RCC/Steel structural design result for a member
   */
  public getDesignResult(memberId: number): MemberDesignSummary | null {
    if (!this.model.designSummaries) return null;
    return this.model.designSummaries.get(memberId) || null;
  }

  /**
   * Returns all failed members across the building
   */
  public getFailedMembers(): MemberDesignSummary[] {
    if (!this.model.designSummaries) return [];
    return Array.from(this.model.designSummaries.values()).filter((d) => d.status === 'FAIL');
  }
}
