import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readRCDC } from '@/features/rcdx/rcdxReader';
import { rcdcToModel } from '@/features/rcdx/rcdxToModel';
import { rcdcToDesigns } from '@/features/rcdx/rcdxToDesigns';
import { buildRCDCMemberIds } from '@/features/rcdx/rcdxKeys';

const ROOT = path.resolve(__dirname, '../..');

const FILES = {
  beamShort: path.join(ROOT, 'STR no cantFINAL-Beam-1-3.2 m.rcdx'),
  beamLong: path.join(ROOT, 'STR no cantFINAL-Beam-1-6.4 m.rcdx'),
  column: path.join(ROOT, 'STR no cantFINAL-Column-1.R1.rcdx'),
  slab: path.join(ROOT, 'STR no cantFINAL-Slab-1-3.2 m.rcdx'),
};

const readBytes = (p: string) => new Uint8Array(fs.readFileSync(p).buffer.slice(0));

describe('RCDX reader', () => {
  it('reads the beam .rcdx database and produces beam design output', async () => {
    const doc = await readRCDC(readBytes(FILES.beamShort), 'beam-3.2.rcdx');
    expect(doc.format).toBe('RCDC');
    expect(doc.beams.length).toBeGreaterThan(0);
    expect(doc.loadCases.length).toBeGreaterThan(0);
    expect(doc.loadCombinations.length).toBeGreaterThan(0);

    const beam = doc.beams[0];
    expect(beam.widthMm).toBeGreaterThan(0);
    expect(beam.depthMm).toBeGreaterThan(0);
    expect(beam.clearSpanMm).toBeGreaterThan(0);
    expect(beam.stations.length).toBeGreaterThan(0);
    expect(beam.zones.length).toBeGreaterThan(0);

    const top = beam.topLayers[0];
    if (top) {
      expect(top.ast).toBeGreaterThan(0);
      expect(top.bars[0].diameterMm).toBeGreaterThan(0);
    }
    const stirrup = beam.shearZones[0];
    if (stirrup) {
      expect(stirrup.spacingMm).toBeGreaterThan(0);
      expect(stirrup.diameterMm).toBeGreaterThan(0);
    }

    const designs = rcdcToDesigns(doc);
    const ids = buildRCDCMemberIds(doc);
    for (const b of doc.beams) {
      const entry = designs.savedBeamDesigns[ids.beamId.get(b.beamNo) ?? b.beamNo];
      expect(entry).toBeDefined();
      expect(entry.bMm).toBe(b.widthMm);
      expect(entry.D).toBe(b.depthMm);
      expect(entry.topRebar.callout).toBeTruthy();
      expect(entry.shear.stirrupDiameter).toBeGreaterThan(0);
    }
  });

  it('reads the column .rcdx database with rebar + coordinates', async () => {
    const doc = await readRCDC(readBytes(FILES.column), 'column.rcdx');
    expect(doc.columns.length).toBeGreaterThan(0);
    const col = doc.columns[0];
    expect(col.widthMm).toBeGreaterThan(0);
    expect(col.depthMm).toBeGreaterThan(0);
    expect(col.mainBars.length).toBeGreaterThan(0);
    expect(col.linkZones.length).toBeGreaterThan(0);
    expect(col.barCoords?.length).toBeGreaterThan(0);

    const designs = rcdcToDesigns(doc);
    const ids = buildRCDCMemberIds(doc);
    const entry = designs.savedColumnDesigns[ids.columnId.get(col.columnNo) ?? col.columnNo];
    expect(entry).toBeDefined();
    expect(entry.bMm).toBe(col.widthMm);
    expect(entry.D).toBe(col.depthMm);
    const totalMain = col.mainBars.reduce((s, m) => s + m.count, 0);
    expect(entry.rebar.totalBars).toBe(totalMain);
    expect(entry.rebar.cornerBars.count).toBe(4);
    if (totalMain > 4) {
      expect(entry.rebar.faceBars).toBeDefined();
    }
  });

  it('reads the slab .rcdx database with panel reinforcement', async () => {
    const doc = await readRCDC(readBytes(FILES.slab), 'slab.rcdx');
    expect(doc.slabs.length).toBeGreaterThan(0);
    const slab = doc.slabs[0];
    expect(slab.thicknessMm).toBeGreaterThan(0);
    expect(slab.nodeNos.length).toBeGreaterThanOrEqual(4);
    expect(slab.astProvMain).toBeGreaterThanOrEqual(0);
    expect(slab.reinforcement.length).toBeGreaterThan(0);
  });

  it('maps the beam document into a structural model consumed by the 3D viewer', async () => {
    const doc = await readRCDC(readBytes(FILES.beamLong), 'beam-6.4.rcdx');
    const model = rcdcToModel(doc);
    expect(model.nodes.size).toBeGreaterThan(0);
    expect(model.members.size).toBeGreaterThan(0);
    expect(model.designSummaries?.size).toBe(doc.beams.length + doc.columns.length);
    expect(model.loadCombinations.size).toBe(doc.loadCombinations.length);
    for (const comb of model.loadCombinations.values()) {
      expect(comb.factors.length).toBeGreaterThan(0);
    }
  });

  it('builds a full document sweep over all four sample files without throwing', async () => {
    for (const key of ['beamShort', 'beamLong', 'column', 'slab'] as const) {
      const doc = await readRCDC(readBytes(FILES[key]), `${key}.rcdx`);
      expect(doc.warnings).toBeDefined();
      rcdcToModel(doc);
      rcdcToDesigns(doc);
    }
  });
});