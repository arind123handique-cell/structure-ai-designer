import { describe, it, expect } from 'vitest';
import { IfcStructuralEngine } from '@/features/architectural/engines/ifcStructuralEngine';

describe('IFC BIM Architecture & Structural Mapping (Architecture Sections 28 & 31)', () => {
  const sampleIfcContent = `
ISO-10303-21;
HEADER;
FILE_NAME('sample_building.ifc','2026-09-05',(''),(''),'Revit 2025','Revit','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#35=IFCBUILDINGSTOREY('3Zu5Bv0LOHrPC10026FoQQ',#18,'GL',$,$,#34,$,'GL',.ELEMENT.,0.);
#39=IFCBUILDINGSTOREY('3DVmSd87H3aRGbeSEtXI9n',#18,'Ground Floor Plan',$,$,#38,$,'Ground Floor Plan',.ELEMENT.,0.6);
#43=IFCBUILDINGSTOREY('15Z0v90RiHrPC20026FoKR',#18,'First Floor Plan',$,$,#42,$,'First Floor Plan',.ELEMENT.,3.6);
#101=IFCCOLUMN('col_guid_12345678901234',#18,'C1 - 300x450mm',$,$,#100,$,$);
#102=IFCCOLUMN('col_guid_12345678901235',#18,'C2 - 300x450mm',$,$,#100,$,$);
#201=IFCBEAM('beam_guid_1234567890123',#18,'B1 - 250x450mm',$,$,#200,$,$);
#301=IFCSLAB('slab_guid_1234567890123',#18,'Slab Panel S1',$,$,#300,$,$);
#401=IFCWALL('wall_guid_1234567890123',#18,'Brick Masonry Wall',$,$,#400,$,$);
ENDSEC;
`;

  it('scans and extracts physical storeys and BIM objects from IFC content', () => {
    const bim = IfcStructuralEngine.parseIfc(sampleIfcContent);

    expect(bim.storeys.length).toBe(3);
    expect(bim.columns.length).toBe(2);
    expect(bim.beams.length).toBe(1);
    expect(bim.slabs.length).toBe(1);
    expect(bim.walls.length).toBe(1);

    expect(bim.statistics.totalConcreteVolumeM3).toBeGreaterThan(0);
    expect(bim.statistics.totalWallAreaM2).toBeGreaterThan(0);
  });

  it('interprets physical BIM objects into an analytical FEM structural model', () => {
    const bim = IfcStructuralEngine.parseIfc(sampleIfcContent);
    const model = IfcStructuralEngine.interpretToStructuralModel(bim);

    expect(model.nodes.size).toBeGreaterThan(0);
    expect(model.members.size).toBe(3); // 2 columns + 1 beam
    expect(model.plates.size).toBe(1); // 1 slab plate
    expect(model.supports.size).toBeGreaterThan(0);

    const cols = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    const bms = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');

    expect(cols.length).toBe(2);
    expect(bms.length).toBe(1);
    expect(cols[0].section.type).toBe('RECTANGULAR');
  });
});
