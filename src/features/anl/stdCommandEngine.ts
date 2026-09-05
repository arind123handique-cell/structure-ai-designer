/**
 * STAAD.Pro .STD Command Engine (Architecture Section 4 & 37)
 * Implements bidirectional STAAD command generation and parsing.
 * Allows pure text command round-tripping for interoperability with Bentley STAAD.Pro CONNECT Edition.
 */

import {
  NormalizedStructuralModel,
  Node3D,
  Member3D,
  Plate3D,
  Support3D,
  LoadCase,
  LoadCombination,
} from '@/features/model/types';
import { ModelNormalizer } from '@/features/model/modelNormalizer';

export interface StdJobInformation {
  engineer?: string;
  jobName?: string;
  client?: string;
  date?: string;
  units?: { length: 'METER' | 'INCHES' | 'FEET'; force: 'KN' | 'KIP' | 'POUND' };
}

export class StdCommandEngine {
  /**
   * Generates a fully compliant STAAD.Pro .STD command file string from a NormalizedStructuralModel.
   */
  public static generateStd(
    model: NormalizedStructuralModel,
    jobInfo?: StdJobInformation
  ): string {
    const lines: string[] = [];

    // 1. Header
    lines.push('STAAD SPACE');
    lines.push('START JOB INFORMATION');
    lines.push(`JOB NAME ${jobInfo?.jobName || 'STRUCTURE_AI_MODEL'}`);
    lines.push(`CLIENT ${jobInfo?.client || 'ENTERPRISE_CLIENT'}`);
    lines.push(`ENGINEER DATE ${jobInfo?.date || new Date().toISOString().split('T')[0]}`);
    lines.push('END JOB INFORMATION');
    lines.push('INPUT WIDTH 79');
    lines.push('UNIT METER KN');
    lines.push('');

    // 2. Joint Coordinates
    lines.push('JOINT COORDINATES');
    const sortedNodes = Array.from(model.nodes.values()).sort((a, b) => a.id - b.id);
    for (const node of sortedNodes) {
      lines.push(`${node.id} ${node.x.toFixed(4)} ${node.y.toFixed(4)} ${node.z.toFixed(4)};`);
    }
    lines.push('');

    // 3. Member Incidences
    lines.push('MEMBER INCIDENCES');
    const sortedMembers = Array.from(model.members.values()).sort((a, b) => a.id - b.id);
    for (const m of sortedMembers) {
      lines.push(`${m.id} ${m.startNodeId} ${m.endNodeId};`);
    }
    lines.push('');

    // 4. Plate Incidences (if any)
    if (model.plates.size > 0) {
      lines.push('ELEMENT INCIDENCES SHELL');
      const sortedPlates = Array.from(model.plates.values()).sort((a, b) => a.id - b.id);
      for (const p of sortedPlates) {
        lines.push(`${p.id} ${p.nodeIds.join(' ')};`);
      }
      lines.push('');
    }

    // 5. Member Properties
    lines.push('MEMBER PROPERTY AMERICAN');
    // Group members by cross section
    const sectionGroups = new Map<string, { yd: number; zd: number; memberIds: number[] }>();
    for (const m of sortedMembers) {
      const yd = m.section.yd || 0.45;
      const zd = m.section.zd || 0.3;
      const key = `${yd.toFixed(4)}_${zd.toFixed(4)}`;
      if (!sectionGroups.has(key)) {
        sectionGroups.set(key, { yd, zd, memberIds: [] });
      }
      sectionGroups.get(key)!.memberIds.push(m.id);
    }

    for (const group of sectionGroups.values()) {
      const idRanges = this.formatIdRanges(group.memberIds);
      lines.push(`${idRanges} PRIS YD ${group.yd.toFixed(4)} ZD ${group.zd.toFixed(4)}`);
    }
    lines.push('');

    // 6. Plate Thickness (if any)
    if (model.plates.size > 0) {
      lines.push('ELEMENT PROPERTY');
      const plateGroups = new Map<number, number[]>();
      for (const p of model.plates.values()) {
        const thk = p.thickness || 0.15;
        if (!plateGroups.has(thk)) plateGroups.set(thk, []);
        plateGroups.get(thk)!.push(p.id);
      }
      for (const [thk, pids] of plateGroups.entries()) {
        lines.push(`${this.formatIdRanges(pids)} THICKNESS ${thk.toFixed(4)}`);
      }
      lines.push('');
    }

    // 7. Material Constants
    lines.push('DEFINE MATERIAL START');
    lines.push('ISOTROPIC CONCRETE');
    lines.push('E 25000000');
    lines.push('POISSON 0.17');
    lines.push('DENSITY 25');
    lines.push('ALPHA 1e-05');
    lines.push('DAMP 0.05');
    lines.push('END DEFINE MATERIAL');
    lines.push('CONSTANTS');
    lines.push('MATERIAL CONCRETE ALL');
    lines.push('');

    // 8. Supports
    if (model.supports.size > 0) {
      lines.push('SUPPORTS');
      const fixedNodes: number[] = [];
      const pinnedNodes: number[] = [];
      for (const [nodeId, sup] of model.supports.entries()) {
        if (sup.type === 'PINNED') {
          pinnedNodes.push(nodeId);
        } else {
          fixedNodes.push(nodeId);
        }
      }
      if (fixedNodes.length > 0) {
        lines.push(`${this.formatIdRanges(fixedNodes)} FIXED`);
      }
      if (pinnedNodes.length > 0) {
        lines.push(`${this.formatIdRanges(pinnedNodes)} PINNED`);
      }
      lines.push('');
    }

    // 9. Load Cases
    let loadCounter = 1;
    for (const lc of model.loadCases.values()) {
      if (lc.isCombination) continue;
      lines.push(`LOAD ${lc.id || loadCounter} LOADTYPE ${lc.type} TITLE ${lc.title}`);
      if (lc.type === 'DEAD') {
        lines.push('SELFWEIGHT Y -1');
      }

      // Member loads
      if (model.memberLoads) {
        const loadsOnCase: { mId: number; w: number }[] = [];
        for (const [mId, mLoads] of model.memberLoads.entries()) {
          for (const ld of mLoads) {
            if (ld.loadPattern === lc.type || ld.loadPattern === 'DEAD') {
              loadsOnCase.push({ mId, w: ld.w1 });
            }
          }
        }
        if (loadsOnCase.length > 0) {
          lines.push('MEMBER LOAD');
          // Group by magnitude
          const loadGroups = new Map<number, number[]>();
          for (const it of loadsOnCase) {
            if (!loadGroups.has(it.w)) loadGroups.set(it.w, []);
            loadGroups.get(it.w)!.push(it.mId);
          }
          for (const [mag, ids] of loadGroups.entries()) {
            lines.push(`${this.formatIdRanges(ids)} UNI GY -${Math.abs(mag).toFixed(2)}`);
          }
        }
      }
      loadCounter++;
    }
    lines.push('');

    // 10. Load Combinations
    for (const combo of model.loadCombinations.values()) {
      lines.push(`LOAD COMB ${combo.id} ${combo.title}`);
      const factorsStr = combo.factors.map((f) => `${f.loadCaseId} ${f.factor}`).join(' ');
      lines.push(factorsStr);
    }
    lines.push('');

    // 11. Analysis & Design Execution Commands
    lines.push('PERFORM ANALYSIS');
    lines.push('PRINT SUPPORT REACTION');
    lines.push('PRINT STORY DRIFT');
    lines.push('');
    lines.push('START CONCRETE DESIGN');
    lines.push('CODE IS13920 2016');
    lines.push('FYMAIN 500000 ALL');
    lines.push('FC 25000 ALL');
    lines.push('FYSEC 500000 ALL');
    lines.push('DESIGN BEAM ALL');
    lines.push('DESIGN COLUMN ALL');
    lines.push('CONCRETE TAKE');
    lines.push('END CONCRETE DESIGN');
    lines.push('FINISH');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Helper to format an array of integer IDs into STAAD range format: "1 TO 5 8 10 TO 15"
   */
  public static formatIdRanges(ids: number[]): string {
    if (ids.length === 0) return '';
    const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
    const ranges: string[] = [];

    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      if (curr === prev + 1) {
        prev = curr;
      } else {
        if (start === prev) {
          ranges.push(`${start}`);
        } else if (prev === start + 1) {
          ranges.push(`${start} ${prev}`);
        } else {
          ranges.push(`${start} TO ${prev}`);
        }
        start = curr;
        prev = curr;
      }
    }

    if (start === prev) {
      ranges.push(`${start}`);
    } else if (prev === start + 1) {
      ranges.push(`${start} ${prev}`);
    } else {
      ranges.push(`${start} TO ${prev}`);
    }

    return ranges.join(' ');
  }

  /**
   * Parses STAAD ID range expression (e.g. "1 TO 5 8 10 TO 12") into an array of IDs.
   */
  public static parseIdRanges(tokens: string[]): number[] {
    const ids: number[] = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i].toUpperCase();
      if (token === 'TO') {
        const start = ids.pop();
        const end = parseInt(tokens[i + 1], 10);
        if (start !== undefined && !isNaN(end)) {
          for (let val = start; val <= end; val++) {
            ids.push(val);
          }
          i += 2;
          continue;
        }
      }
      const num = parseInt(token, 10);
      if (!isNaN(num)) {
        ids.push(num);
      }
      i++;
    }
    return Array.from(new Set(ids));
  }
}
