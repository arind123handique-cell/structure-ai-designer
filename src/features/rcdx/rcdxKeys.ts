import { RCDCDocument } from './types';

/**
 * RCDC design output is keyed by the original RCDC beams/columns numbers while the
 * app model keys members by a single global `memberId` integer sequence. This module
 * defines the global numbering used across the RCDX import: beams take ids 1..N and
 * columns take ids N+1..N+M (N = number of beams in the file).
 */
export interface RCDCMemberIds {
  beamId: Map<number, number>; // RCDC beamNo -> member id
  columnId: Map<number, number>; // RCDC columnNo -> member id
  beamOriginalNo: Map<number, number>; // member id -> RCDC beamNo
  columnOriginalNo: Map<number, number>; // member id -> RCDC columnNo
}

export function buildRCDCMemberIds(doc: RCDCDocument): RCDCMemberIds {
  const beamId = new Map<number, number>();
  const beamOriginalNo = new Map<number, number>();
  for (const beam of doc.beams) {
    beamId.set(beam.beamNo, beam.beamNo);
    beamOriginalNo.set(beam.beamNo, beam.beamNo);
  }
  const columnId = new Map<number, number>();
  const columnOriginalNo = new Map<number, number>();
  const beamCount = doc.beams.length;
  for (const col of doc.columns) {
    const id = beamCount + col.columnNo;
    columnId.set(col.columnNo, id);
    columnOriginalNo.set(id, col.columnNo);
  }
  return { beamId, columnId, beamOriginalNo, columnOriginalNo };
}