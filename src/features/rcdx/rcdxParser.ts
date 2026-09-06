import { readRCDC } from './rcdxReader';
import { rcdcToModel } from './rcdxToModel';
import { rcdcToDesigns, RCDXDesignPayload } from './rcdxToDesigns';
import { RCDCDocument } from './types';
import { NormalizedStructuralModel } from '@/features/model/types';
import { EngineeringWarning } from '@/features/warnings/types';

export interface RCDXParseResult {
  model: NormalizedStructuralModel;
  rcdcDocument: RCDCDocument;
  designs: RCDXDesignPayload;
  warnings: EngineeringWarning[];
  setActiveViewTo?: '3d-model' | 'rcdc-design';
}

export function rcdxWarningsToEngineering(doc: RCDCDocument): EngineeringWarning[] {
  return doc.warnings.map((msg, i) => ({
    id: `rcdx-${i}`,
    severity: 'INFO' as const,
    category: 'PARSER' as const,
    message: msg,
    source: 'RCDC Reader',
  }));
}

/**
 * Parses an STAAD RCDC (.rcdx) design database file into a full app model plus
 * the actual RCDC-concrete reinforced-concrete design output:
 *
 *   - model         → NormalizedStructuralModel (geometry, loads, combos, envelopes, design summaries)
 *   - rcdcDocument  → full normalized RCDCDocument (beams/columns/slabs with reinforcement, zones, detailing)
 *   - designs       → savedBeamDesigns / savedColumnDesigns consumable by the 3D viewer & drawers
 *   - warnings      → EngineeringWarning[]
 */
export async function parseRCDC(bytes: Uint8Array, fileName: string): Promise<RCDXParseResult> {
  const rcdcDocument = await readRCDC(bytes, fileName);

  if (!/\.rcdx$/i.test(fileName)) {
    rcdcDocument.warnings.push(`File "${fileName}" does not have a .rcdx extension; parsed as SQLite RCDC database.`);
  }

  const model = rcdcToModel(rcdcDocument);
  const designs = rcdcToDesigns(rcdcDocument);
  const warnings = rcdxWarningsToEngineering(rcdcDocument);

  return { model, rcdcDocument, designs, warnings };
}

export { readRCDC } from './rcdxReader';
export { rcdcToModel } from './rcdxToModel';
export { rcdcToDesigns } from './rcdxToDesigns';