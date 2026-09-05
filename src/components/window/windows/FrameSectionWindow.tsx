import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowField,
  SelField,
  NumField,
  TxtField,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  SectionPreview,
  StatusChip,
  SelectOption,
} from '../WindowUI';

interface SectionPreset {
  name: string;
  type: 'RECTANGULAR' | 'CIRCULAR';
  b: number; // width mm
  d: number; // depth mm
  classification: 'BEAM' | 'COLUMN';
}

const PRESETS: SectionPreset[] = [
  { name: 'B230x450', type: 'RECTANGULAR', b: 230, d: 450, classification: 'BEAM' },
  { name: 'B300x450', type: 'RECTANGULAR', b: 300, d: 450, classification: 'BEAM' },
  { name: 'B300x600', type: 'RECTANGULAR', b: 300, d: 600, classification: 'BEAM' },
  { name: 'B300x750', type: 'RECTANGULAR', b: 300, d: 750, classification: 'BEAM' },
  { name: 'B350x700', type: 'RECTANGULAR', b: 350, d: 700, classification: 'BEAM' },
  { name: 'C300x300', type: 'RECTANGULAR', b: 300, d: 300, classification: 'COLUMN' },
  { name: 'C400x400', type: 'RECTANGULAR', b: 400, d: 400, classification: 'COLUMN' },
  { name: 'C450x450', type: 'RECTANGULAR', b: 450, d: 450, classification: 'COLUMN' },
  { name: 'C500x500', type: 'RECTANGULAR', b: 500, d: 500, classification: 'COLUMN' },
  { name: 'C600x600', type: 'RECTANGULAR', b: 600, d: 600, classification: 'COLUMN' },
  { name: 'CIRC400', type: 'CIRCULAR', b: 400, d: 400, classification: 'COLUMN' },
];

/**
 * DEFINE → FRAME SECTION PROPERTY
 *
 * Create/edit frame sections (rectangular/circular) with auto-calculated
 * section properties (A, Ix, Iy, J, effective depth). Assign to selected
 * members or globally to all beams/columns.
 */
export const FrameSectionWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const assignMemberSection = useProjectStore((s) => s.assignMemberSection);
  const batchUpdateSections = useProjectStore((s) => s.batchUpdateSections);
  const activeModel = useProjectStore((s) => s.activeModel);

  const [type, setType] = useState<'RECTANGULAR' | 'CIRCULAR'>('RECTANGULAR');
  const [name, setName] = useState('B300x450');
  const [b, setB] = useState('300'); // width mm
  const [d, setD] = useState('450'); // depth mm
  const [cover, setCover] = useState('40');
  const [scope, setScope] = useState<'selected' | 'beams' | 'columns'>('selected');

  const widthMm = parseFloat(b) || 0;
  const depthMm = parseFloat(d) || 0;
  const coverMm = parseFloat(cover) || 0;

  const derived = useMemo(() => {
    const bm = widthMm / 1000;
    const dm = depthMm / 1000;
    if (type === 'CIRCULAR') {
      const r = bm / 2;
      const A = Math.PI * r * r;
      const I = (Math.PI * Math.pow(bm, 4)) / 64;
      const J = (Math.PI * Math.pow(bm, 4)) / 32;
      return { area: A * 1e6, ix: I * 1e12, iy: I * 1e12, j: J * 1e12, deff: dm - coverMm / 1000 };
    }
    const A = bm * dm;
    const Ixx = (bm * Math.pow(dm, 3)) / 12;
    const Iyy = (dm * Math.pow(bm, 3)) / 12;
    const J = 0.229 * bm * Math.pow(dm, 3); // approx for rectangular
    return { area: A * 1e6, ix: Ixx * 1e12, iy: Iyy * 1e12, j: J * 1e12, deff: dm - coverMm / 1000 };
  }, [type, widthMm, depthMm, coverMm]);

  const onSelectPreset = (p: SectionPreset) => {
    setType(p.type);
    setB(String(p.b));
    setD(String(p.d));
    setName(p.name);
    setScope(p.classification === 'BEAM' ? 'beams' : 'columns');
  };

  const apply = async (doClose: boolean) => {
    const members = activeModel ? Array.from(activeModel.members.values()) : [];
    let targets = members;
    if (scope === 'beams') targets = members.filter((m) => m.classification === 'BEAM');
    else if (scope === 'columns') targets = members.filter((m) => m.classification === 'COLUMN');
    else if (scope === 'selected') {
      // single selected member (store's selectMember)
      const sel = useProjectStore.getState().selectedMemberId;
      targets = sel != null ? members.filter((m) => m.id === sel) : [];
    }

    if (scope === 'selected' && targets.length === 0) {
      alert('No member selected. Select a member in the plan canvas first, or use Beams/Columns scope.');
      return;
    }

    const section = {
      type,
      yd: depthMm / 1000,
      zd: type === 'CIRCULAR' ? widthMm / 1000 : widthMm / 1000,
      name,
    };

    if (type === 'CIRCULAR') {
      await assignMemberSection(targets.map((m) => m.id), section as any);
    } else {
      await assignMemberSection(
        targets.map((m) => m.id),
        { type, yd: depthMm / 1000, zd: widthMm / 1000, name }
      );
    }
    setDirty(false);
    if (doClose) close();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Preset Library">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => onSelectPreset(p)}
                className={`px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                  name === p.name
                    ? 'bg-sky-700 border-sky-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </WindowSection>

        <WindowSection title="Section Definition">
          <div className="grid grid-cols-2 gap-2">
            <TxtField label="Name" value={name} onChange={setName} />
            <SelField
              label="Shape"
              value={type}
              onChange={(v) => setType(v as any)}
              options={[
                { value: 'RECTANGULAR', label: 'Rectangular' },
                { value: 'CIRCULAR', label: 'Circular' },
              ]}
            />
            <NumField label={type === 'CIRCULAR' ? 'Diameter' : 'Width'} unit="mm" value={b} onChange={setB} />
            {type === 'RECTANGULAR' && <NumField label="Depth" unit="mm" value={d} onChange={setD} />}
            <NumField label="Clear Cover" unit="mm" value={cover} onChange={setCover} />
          </div>
        </WindowSection>

        <WindowSection title="Section Preview & Properties">
          <SectionPreview
            widthMm={type === 'CIRCULAR' ? widthMm : widthMm}
            depthMm={type === 'RECTANGULAR' ? depthMm : undefined}
            diameterMm={type === 'CIRCULAR' ? widthMm : undefined}
          />
          <table className="w-full mt-2 text-xs">
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="py-1 text-slate-400">Area A</td>
                <td className="py-1 text-right text-slate-200">{derived.area.toFixed(0)} mm²</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-1 text-slate-400">Ix</td>
                <td className="py-1 text-right text-slate-200">{(derived.ix / 1e6).toFixed(1)} ×10⁶ mm⁴</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-1 text-slate-400">Iy</td>
                <td className="py-1 text-right text-slate-200">{(derived.iy / 1e6).toFixed(1)} ×10⁶ mm⁴</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-1 text-slate-400">Torsion J</td>
                <td className="py-1 text-right text-slate-200">{(derived.j / 1e6).toFixed(1)} ×10⁶ mm⁴</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-400">Effective Depth d</td>
                <td className="py-1 text-right text-slate-200">{(derived.deff * 1000).toFixed(1)} mm</td>
              </tr>
            </tbody>
          </table>
        </WindowSection>

        <WindowSection title="Assignment Scope">
          <SelField
            label="Apply Section To"
            value={scope}
            onChange={(v) => setScope(v as any)}
            options={[
              { value: 'selected', label: 'Selected member only' },
              { value: 'beams', label: 'All beams' },
              { value: 'columns', label: 'All columns' },
            ]}
          />
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={() => apply(false)}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={() => apply(true)}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};