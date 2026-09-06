import React, { useMemo, useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { buildRCDCMemberIds } from '@/features/rcdx/rcdxKeys';
import { Box, Columns3, Grid3x3, PanelTop, Database, ArrowUpRight, HardHat, CheckCircle2 } from 'lucide-react';

type TabKind = 'beams' | 'columns' | 'slabs';

const STATUS_STYLES: Record<string, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const s = status || 'INFO';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${STATUS_STYLES[s] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {s === 'PASS' ? <CheckCircle2 className="w-3 h-3" /> : <HardHat className="w-3 h-3" />}
      {s}
    </span>
  );
};

export const RcdcDesignView: React.FC = () => {
  const { rcdcData, setActiveView, selectMember } = useProjectStore();
  const [tab, setTab] = useState<TabKind>('beams');

  const ids = useMemo(() => (rcdcData ? buildRCDCMemberIds(rcdcData) : null), [rcdcData]);

  if (!rcdcData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 font-sans">
        <Database className="w-12 h-12 text-slate-300" />
        <h3 className="font-mono text-sm font-bold text-slate-700">No RCDC design data loaded</h3>
        <p className="text-xs text-slate-500 max-w-md text-center">
          Import a STAAD RCDC .rcdx design file to view the actual reinforced concrete output (beams, columns, slabs).
        </p>
      </div>
    );
  }

  const doc = rcdcData;
  const totalBeamAst = doc.beams.reduce((s, b) => s + (b.topLayers[0]?.ast || 0) + (b.bottomLayers[0]?.ast || 0), 0);
  const totalColumnAst = doc.columns.reduce((s, c) => s + (c.mainBars[0]?.areaMm2 || 0), 0);
  const concreteName = doc.concreteGrades[0]?.name || 'RCC';
  const steelName = doc.steelGrades[0]?.name || 'Fe500';

  const goToMember = (memberId: number) => {
    selectMember(memberId);
    setActiveView('3d-model');
  };

  const open3d = () => setActiveView('3d-model');

  const tabs: { key: TabKind; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'beams', label: 'Beams', icon: <PanelTop className="w-4 h-4" />, count: doc.beams.length },
    { key: 'columns', label: 'Columns', icon: <Columns3 className="w-4 h-4" />, count: doc.columns.length },
    { key: 'slabs', label: 'Slabs', icon: <Grid3x3 className="w-4 h-4" />, count: doc.slabs.length },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-600/10 text-emerald-700 rounded font-mono text-[10px] font-bold uppercase">
              STAAD RCDC Output
            </span>
          </div>
          <h2 className="mt-1.5 font-mono text-xl font-bold text-deep-navy">
            Concrete Design Results
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {doc.metadata.fileName} • {doc.metadata.rcdcVersion || 'STAAD.Pro RCDC'}
            {concreteName && (
              <> • {concreteName} / {steelName} main steel</>
            )}
          </p>
        </div>
        <button
          onClick={open3d}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-deep-navy text-white hover:bg-slate-800 rounded font-mono text-xs font-semibold shadow transition-colors"
        >
          <Box className="w-3.5 h-3.5" /> Open 3D Model <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Beams', value: doc.beams.length, sub: `${doc.beams.reduce((s, b) => s + b.stations.length, 0)} design stations`, color: 'text-emerald-700' },
          { label: 'Columns', value: doc.columns.length, sub: `Σ ${Math.round(totalColumnAst / 1000)} cm² main bars`, color: 'text-blue-700' },
          { label: 'Slab Panels', value: doc.slabs.length, sub: `${doc.slabs.filter((sp) => sp.astProvMain > 0).length} reinforced`, color: 'text-purple-700' },
          { label: 'Total Ast', value: `${(totalBeamAst / 1000).toFixed(0)} cm²`, sub: 'beam flexure only', color: 'text-slate-700' },
        ].map((c) => (
          <div key={c.label} className="bg-surface-card border border-ui-border rounded-lg p-4">
            <div className={`text-2xl font-mono font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{c.label}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ui-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded-full">{t.count}</span>
          </button>
        ))}
        {doc.warnings.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-amber-600">{doc.warnings.length} reader warnings</span>
        )}
      </div>

      {/* Beams tab */}
      {tab === 'beams' && (
        <div className="bg-surface-card border border-ui-border rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2">Beam</th>
                <th className="px-3 py-2">b × D</th>
                <th className="px-3 py-2">Span</th>
                <th className="px-3 py-2">Top Steel</th>
                <th className="px-3 py-2">Bottom Steel</th>
                <th className="px-3 py-2">Stirrups</th>
                <th className="px-3 py-2">Mu (kN·m)</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doc.beams.map((b) => {
                const memberId = ids?.beamId.get(b.beamNo) ?? b.beamNo;
                const top = b.topLayers[0];
                const bottom = b.bottomLayers[0];
                const stirrup = b.shearZones[0];
                const topCallout = (top?.bars ?? []).filter((x) => x.diameterMm > 0).map((x) => `${x.count}-T${x.diameterMm}`).join(' + ') || '—';
                const botCallout = (bottom?.bars ?? []).filter((x) => x.diameterMm > 0).map((x) => `${x.count}-T${x.diameterMm}`).join(' + ') || '—';
                const maxMu = Math.max(0, ...b.stations.map((s) => Math.max(Math.abs(s.momentTop), Math.abs(s.momentBottom))));
                return (
                  <tr key={b.beamNo} onClick={() => goToMember(memberId)} className="hover:bg-emerald-50/40 cursor-pointer">
                    <td className="px-3 py-2 font-semibold text-slate-800">B{b.beamNo}</td>
                    <td className="px-3 py-2 text-slate-600">{b.widthMm}×{b.depthMm}</td>
                    <td className="px-3 py-2 text-slate-600">{(b.clearSpanMm / 1000).toFixed(2)} m</td>
                    <td className="px-3 py-2 text-slate-700">{topCallout}</td>
                    <td className="px-3 py-2 text-slate-700">{botCallout}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {stirrup ? `T${stirrup.diameterMm} @ ${stirrup.spacingMm}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{maxMu.toFixed(1)}</td>
                    <td className="px-3 py-2"><StatusPill status={b.stations.every((s) => s.designFlagTop && s.designFlagBottom && s.shearDesignFlag) ? 'PASS' : 'FAIL'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Columns tab */}
      {tab === 'columns' && (
        <div className="bg-surface-card border border-ui-border rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2">Column</th>
                <th className="px-3 py-2">b × D</th>
                <th className="px-3 py-2">Height</th>
                <th className="px-3 py-2">Main Steel</th>
                <th className="px-3 py-2">Links</th>
                <th className="px-3 py-2">Puz / Pu</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doc.columns.map((c) => {
                const memberId = ids?.columnId.get(c.columnNo) ?? c.columnNo;
                const main = c.mainBars[0];
                const links = c.linkZones.find((l) => l.type === 2) ?? c.linkZones[0];
                return (
                  <tr key={c.columnNo} onClick={() => goToMember(memberId)} className="hover:bg-blue-50/40 cursor-pointer">
                    <td className="px-3 py-2 font-semibold text-slate-800">C{c.columnNo}</td>
                    <td className="px-3 py-2 text-slate-600">{c.widthMm}×{c.depthMm}</td>
                    <td className="px-3 py-2 text-slate-600">{(c.unsupportedLengthMm / 1000).toFixed(2)} m</td>
                    <td className="px-3 py-2 text-slate-700">{main ? `${main.count}-T${main.diameterMm}` : '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{links ? `${links.legs}-L T${links.diameterMm} @ ${links.spacingMm}` : '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{c.interactionRatio}</td>
                    <td className="px-3 py-2"><StatusPill status={c.designFail ? 'FAIL' : c.mainBars.length ? 'PASS' : 'WARNING'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slabs tab */}
      {tab === 'slabs' && (
        <div className="bg-surface-card border border-ui-border rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2">Panel</th>
                <th className="px-3 py-2">Nodes</th>
                <th className="px-3 py-2">Thk</th>
                <th className="px-3 py-2">Span Type</th>
                <th className="px-3 py-2">Ast Reinf.</th>
                <th className="px-3 py-2">Bars / Spacing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doc.slabs.map((s) => {
                const reinf = s.reinforcement[0];
                return (
                  <tr key={s.panelNo} className="hover:bg-purple-50/40">
                    <td className="px-3 py-2 font-semibold text-slate-800">{s.mark}</td>
                    <td className="px-3 py-2 text-slate-600">{s.nodeNos.length}</td>
                    <td className="px-3 py-2 text-slate-600">{s.thicknessMm} mm</td>
                    <td className="px-3 py-2 text-slate-600">{s.spanTypeId === 1 ? 'Simply Supported' : s.spanTypeId === 2 ? 'Continuous' : `Type ${s.spanTypeId}`}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {reinf ? `${(reinf.astProvMm2PerM / 100).toFixed(0)} cm²/m` : s.astProvMain ? `${(s.astProvMain / 100).toFixed(0)} cm²/m` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {reinf && reinf.barDiameterMm > 0
                        ? `T${reinf.barDiameterMm} @ ${Math.round(reinf.barSpacingMm)} c/c`
                        : s.mainBarDiameter > 0
                        ? `T${s.mainBarDiameter} @ ${Math.round(s.mainBarSpacing)} c/c`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};