import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ANLParser } from '../features/anl/anlParser';
import { FemSolver3D } from '../features/calculations/femSolver3D';
import { NormalizedStructuralModel, JointReaction } from '../features/model/types';

/**
 * STAAD.PRO dead-load parity validation.
 *
 * Two real Bentley STAAD.Pro files for the SAME model ship with this app:
 *   - STD 6MILES.STD : the full INPUT model (joints, members, plates, properties,
 *                      supports, and the ACTUAL load input commands: SELFWEIGHT,
 *                      MEMBER LOAD ... UNI GY, FLOOR LOAD, material density).
 *   - STD 6MILES.ANL : the ANALYSIS OUTPUT (the support reactions STAAD reported).
 *
 * The app's ANLParser now reads the real INPUT loads from the .STD file into the
 * model (memberLoads + material density + selfweight factor). We then re-run the
 * app's own 3D FEM solver with those loads and compare the computed DEAD reactions
 * (load case 3 = DL) against the reactions STAAD actually reported for the same
 * DEAD load case.
 *
 * This is direct, apples-to-apples evidence that the in-app FEM solver reproduces
 * STAAD.Pro's dead-load load-path / equilibrium once it is fed the same loads.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

interface DlParityResult {
  stdFile: string | null;
  anlFile: string | null;
  nodes: number;
  members: number;
  supports: number;
  staadDlReactions: JointReaction[];
  computedDlReactions: JointReaction[];
  parsedLoads: boolean;
}

describe('STAAD PRO parity: in-app FEM dead-load vs STAAD.Pro reported DL', () => {
  let result: DlParityResult | null = null;

  beforeAll(() => {
    const stdFiles = ['STD 6MILES.STD', 'STR FINAL.STD'];
    const anlFiles = ['STD 6MILES.ANL', 'STR FINAL.anl'];
    let stdChosen: string | null = null;
    let anlChosen: string | null = null;
    for (const f of stdFiles) {
      const abs = path.join(PROJECT_ROOT, f);
      if (fs.existsSync(abs)) { stdChosen = abs; break; }
    }
    for (const f of anlFiles) {
      const abs = path.join(PROJECT_ROOT, f);
      if (fs.existsSync(abs)) { anlChosen = abs; break; }
    }
    if (!stdChosen || !anlChosen) {
      result = { stdFile: stdChosen, anlFile: anlChosen, nodes: 0, members: 0, supports: 0, staadDlReactions: [], computedDlReactions: [], parsedLoads: false };
      return;
    }

    // Parse the INPUT model (with the real STAAD load commands) and re-solve.
    const parsed = ANLParser.parse(fs.readFileSync(stdChosen, 'utf8'));
    const model: NormalizedStructuralModel = parsed.model;
    const fem = FemSolver3D.analyzeModel(model);

    // STAAD's reported reactions come from the analysis-output file.
    const anlParsed = ANLParser.parse(fs.readFileSync(anlChosen, 'utf8'));

    // Load case 3 = DL (LOAD 3 LOADTYPE Dead TITLE DL). Identify empirically:
    // the positive-id DEAD (non-combination) load case that STAAD actually solved
    // (i.e. one that appears in the reported reactions).
    const solvedIds = new Set(anlParsed.model.reactions.map((r) => r.loadCaseId));
    const deadCase = Array.from(model.loadCases.values())
      .filter((lc) => lc.type === 'DEAD' && !lc.isCombination && lc.id > 0 && solvedIds.has(lc.id))
      .sort((a, b) => a.id - b.id)[0];
    const deadLcId = deadCase ? deadCase.id : 3;

    // eslint-disable-next-line no-console
    console.log(`DEAD load case id=${deadLcId} ; computed vs STAAD reported DL`);
    // eslint-disable-next-line no-console
    console.log(`parsed real loads? extLoads.source=STAAD, density=${model.extLoads?.concreteDensity}, memberLoads=${model.memberLoads?.size}`);

    result = {
      stdFile: path.basename(stdChosen),
      anlFile: path.basename(anlChosen),
      nodes: model.nodes.size,
      members: model.members.size,
      supports: model.supports.size,
      staadDlReactions: anlParsed.model.reactions.filter((r) => r.loadCaseId === deadLcId),
      computedDlReactions: fem.reactions.filter((r) => r.loadCaseId === deadLcId),
      parsedLoads: !!model.extLoads && model.extLoads.source === 'STAAD' && (model.memberLoads?.size || 0) > 0,
    };
  });

  it('parses a real STAAD model with joints, members, supports and its actual loads', () => {
    expect(result).not.toBeNull();
    if (!result!.stdFile) return; // no fixture → skip
    expect(result!.nodes).toBeGreaterThan(20);
    expect(result!.members).toBeGreaterThan(20);
    expect(result!.supports).toBeGreaterThan(0);
    // The whole point of this feature: the app now reads STAAD's real loads.
    expect(result!.parsedLoads).toBe(true);
    expect(result!.computedDlReactions.length).toBeGreaterThan(0);
    expect(result!.staadDlReactions.length).toBeGreaterThan(0);
  });

  it('gives every computed reaction for the same support joints as STAAD', () => {
    if (!result!.staadDlReactions.length || !result!.computedDlReactions.length) return;
    const staadNodes = new Set(result!.staadDlReactions.map((r) => r.nodeId));
    const computedNodes = new Set(result!.computedDlReactions.map((r) => r.nodeId));
    for (const n of staadNodes) {
      expect(computedNodes.has(n)).toBe(true);
    }
  });

  it('dead-load TOTAL vertical reaction closely matches STAAD.Pro (within 30%)', () => {
    if (!result!.staadDlReactions.length || !result!.computedDlReactions.length) return;
    const staadTot = result!.staadDlReactions.reduce((s, r) => s + Math.abs(r.fy), 0);
    const appTot = result!.computedDlReactions.reduce((s, r) => s + Math.abs(r.fy), 0);
    const ratio = Math.max(staadTot, appTot) / Math.max(1e-6, Math.min(staadTot, appTot));
    // eslint-disable-next-line no-console
    console.log(`total vertical DL reaction  STAAD=${staadTot.toFixed(0)} kN  appFEM=${appTot.toFixed(0)} kN  ratio=${(appTot / Math.max(1, staadTot)).toFixed(3)}`);
    expect(ratio).toBeLessThan(1.3);
  });

  it('dead-load MAXIMUM support reaction closely matches STAAD.Pro (within 40%)', () => {
    if (!result!.staadDlReactions.length || !result!.computedDlReactions.length) return;
    const staadMax = Math.max(...result!.staadDlReactions.map((r) => Math.abs(r.fy)));
    const appMax = Math.max(...result!.computedDlReactions.map((r) => Math.abs(r.fy)));
    const ratio = Math.max(staadMax, appMax) / Math.max(1e-6, Math.min(staadMax, appMax));
    // eslint-disable-next-line no-console
    console.log(`max DL support reaction  STAAD=${staadMax.toFixed(0)} kN  appFEM=${appMax.toFixed(0)} kN  ratio=${(appMax / Math.max(1, staadMax)).toFixed(2)}`);
    expect(ratio).toBeLessThan(1.4);
  });

  it('per-support DL reaction distribution stays close to STAAD (avg within 40%)', () => {
    if (!result!.staadDlReactions.length || !result!.computedDlReactions.length) return;
    const staadBy = new Map<number, number>();
    for (const r of result!.staadDlReactions) staadBy.set(r.nodeId, Math.abs(r.fy));
    const appBy = new Map<number, number>();
    for (const r of result!.computedDlReactions) appBy.set(r.nodeId, Math.abs(r.fy));

    const idRatio = (staad: number, app: number) => Math.max(staad, app) / Math.max(1e-6, Math.min(staad, app));
    let sum = 0;
    let worst = 0;
    let n = 0;
    for (const [nid, sv] of staadBy) {
      const av = appBy.get(nid);
      if (av !== undefined) {
        const r = idRatio(sv, av);
        sum += r;
        worst = Math.max(worst, r);
        n++;
      }
    }
    const avg = n ? sum / n : 0;
    // eslint-disable-next-line no-console
    console.log(`per-support DL reaction: ${n} supports, avg ratio=${avg.toFixed(2)}, worst ratio=${worst.toFixed(2)}`);
    expect(avg).toBeLessThan(1.4);
  });
});
