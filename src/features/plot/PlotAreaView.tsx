/**
 * Plot / Site Area View — Stage 1 of the Building Design Pipeline
 *
 * Define the land plot where the building will be placed: plot boundary
 * dimensions, statutory setbacks, building footprint placement, rotation,
 * road side and ground level. Provides an interactive SVG preview and a
 * "Continue to Architectural Plan" handoff into the next pipeline stage.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  PlotSite,
  DEFAULT_PLOT_SITE,
  validatePlotSite,
  computePlotMetrics,
  getBuildingFootprintCorners,
  fitPlotSiteToModel,
  isModelInsidePlotSite,
} from './plotTypes';
import {
  Map,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Compass,
  Box,
  Maximize2,
} from 'lucide-react';

const FIELD_LABELS: { key: keyof PlotSite; label: string; unit: string; step: number }[] = [
  { key: 'plotLength', label: 'Plot Length (X)', unit: 'm', step: 0.5 },
  { key: 'plotWidth', label: 'Plot Width (Z)', unit: 'm', step: 0.5 },
  { key: 'frontSetback', label: 'Front Setback', unit: 'm', step: 0.5 },
  { key: 'rearSetback', label: 'Rear Setback', unit: 'm', step: 0.5 },
  { key: 'leftSetback', label: 'Left Setback', unit: 'm', step: 0.5 },
  { key: 'rightSetback', label: 'Right Setback', unit: 'm', step: 0.5 },
  { key: 'buildingLength', label: 'Building Length (X)', unit: 'm', step: 0.5 },
  { key: 'buildingWidth', label: 'Building Width (Z)', unit: 'm', step: 0.5 },
  { key: 'buildingOffsetX', label: 'Footprint Offset X', unit: 'm', step: 0.5 },
  { key: 'buildingOffsetZ', label: 'Footprint Offset Z', unit: 'm', step: 0.5 },
  { key: 'groundElevation', label: 'Ground Level (PL)', unit: 'm', step: 0.1 },
];

export const PlotAreaView: React.FC = () => {
  const plotSite = useProjectStore((s) => s.plotSite) || DEFAULT_PLOT_SITE;
  const activeModel = useProjectStore((s) => s.activeModel);
  const setPlotSite = useProjectStore((s) => s.setPlotSite);
  const fitSitePlanToModel = useProjectStore((s) => (s as any).fitSitePlanToModel);
  const moveModelToSitePlan = useProjectStore((s) => (s as any).moveModelToSitePlan);
  const setActiveView = useProjectStore((s) => s.setActiveView);

  const [draft, setDraft] = useState<PlotSite>(() => ({ ...plotSite }));

  useEffect(() => {
    setDraft({ ...plotSite });
  }, [plotSite]);

  const validation = useMemo(() => validatePlotSite(draft), [draft]);
  const metrics = useMemo(() => computePlotMetrics(draft), [draft]);
  const footprintCorners = useMemo(() => getBuildingFootprintCorners(draft), [draft]);

  const modelPlotAlignment = useMemo(() => {
    if (!activeModel || activeModel.nodes.size === 0) return null;
    return isModelInsidePlotSite(activeModel.boundingBox, draft);
  }, [activeModel, draft]);

  const updateField = (key: keyof PlotSite, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }));
  };

  const handleSave = async () => {
    if (!validation.valid) return;
    await setPlotSite(draft);
  };

  const handleContinue = async () => {
    if (!validation.valid) return;
    await setPlotSite(draft);
    setActiveView('architectural-plan');
  };

  const handleFitSiteToModel = async () => {
    if (!activeModel || activeModel.nodes.size === 0) return;
    const fitted = fitPlotSiteToModel(activeModel.boundingBox, {
      front: draft.frontSetback,
      rear: draft.rearSetback,
      left: draft.leftSetback,
      right: draft.rightSetback,
    });
    setDraft(fitted);
    await setPlotSite(fitted);
  };

  const handleMoveModelToSite = async () => {
    if (validation.valid) {
      await setPlotSite(draft);
      await moveModelToSitePlan();
    }
  };

  // SVG viewbox: pad plot bounds and 3D model extents
  const plotX0 = draft.plotOriginX;
  const plotZ0 = draft.plotOriginZ;
  const plotX1 = draft.plotOriginX + draft.plotLength;
  const plotZ1 = draft.plotOriginZ + draft.plotWidth;

  const mMinX = activeModel && activeModel.nodes.size > 0 ? activeModel.boundingBox.minX : plotX0;
  const mMaxX = activeModel && activeModel.nodes.size > 0 ? activeModel.boundingBox.maxX : plotX1;
  const mMinZ = activeModel && activeModel.nodes.size > 0 ? activeModel.boundingBox.minZ : plotZ0;
  const mMaxZ = activeModel && activeModel.nodes.size > 0 ? activeModel.boundingBox.maxZ : plotZ1;

  const pad = 2;
  const vbX0 = Math.min(plotX0, mMinX) - pad;
  const vbX1 = Math.max(plotX1, mMaxX) + pad;
  const vbZ0 = Math.min(plotZ0, mMinZ) - pad;
  const vbZ1 = Math.max(plotZ1, mMaxZ) + pad;
  const vbW = Math.max(1, vbX1 - vbX0);
  const vbH = Math.max(1, vbZ1 - vbZ0);

  // Road side polygon
  const roadSide = draft.roadSide;
  const roadPoints = useMemo(() => {
    const m = 1.2; // road strip depth in meters
    switch (roadSide) {
      case 'FRONT':
        return `${plotX0},${plotZ0 - m} ${plotX1},${plotZ0 - m} ${plotX1},${plotZ0} ${plotX0},${plotZ0}`;
      case 'BACK':
        return `${plotX0},${plotZ1} ${plotX1},${plotZ1} ${plotX1},${plotZ1 + m} ${plotX0},${plotZ1 + m}`;
      case 'LEFT':
        return `${plotX0 - m},${plotZ0} ${plotX0},${plotZ0} ${plotX0},${plotZ1} ${plotX0 - m},${plotZ1}`;
      case 'RIGHT':
        return `${plotX1},${plotZ0} ${plotX1 + m},${plotZ0} ${plotX1 + m},${plotZ1} ${plotX1},${plotZ1}`;
    }
  }, [roadSide, plotX0, plotX1, plotZ0, plotZ1]);

  const footPrintPath = footprintCorners
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.z.toFixed(2)}`)
    .join(' ') + ' Z';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden font-mono text-xs text-slate-200 select-none">
      {/* Header */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Map className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Plot &amp; Site Area</h1>
            <p className="text-[10px] text-slate-400">Stage 1 / 6 — Define where the building will be placed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded border text-[10px] font-bold ${validation.valid ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' : 'bg-red-950/60 text-red-400 border-red-800'}`}>
            {validation.valid ? 'PLOT VALID' : `${validation.errors.length} ISSUE${validation.errors.length > 1 ? 'S' : ''}`}
          </span>
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold disabled:opacity-40 transition-all"
          >
            Save Plot
          </button>
          <button
            onClick={handleContinue}
            disabled={!validation.valid}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
            title="Save plot and open the architectural plan stage"
          >
            <span>Architectural Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => { if (validation.valid) { await setPlotSite(draft); setActiveView('site-3d'); } }}
            disabled={!validation.valid}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
            title="Save plot and open the site plan + 3D model side-by-side"
          >
            <span>View with 3D</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Inputs */}
        <div className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/60 overflow-y-auto p-4 space-y-4">
          {activeModel && activeModel.nodes.size > 0 && (
            <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-sky-400" />
                  3D Model Alignment
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                  modelPlotAlignment?.isInside
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                    : 'bg-amber-950/80 text-amber-400 border-amber-700'
                }`}>
                  {modelPlotAlignment?.isInside ? 'INSIDE PLOT' : 'OUTSIDE PLOT'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-0.5">
                <div>Dimensions: <strong className="text-white">{(activeModel.boundingBox.maxX - activeModel.boundingBox.minX).toFixed(1)}m × {(activeModel.boundingBox.maxZ - activeModel.boundingBox.minZ).toFixed(1)}m</strong></div>
                <div>Origin X, Z: [{activeModel.boundingBox.minX.toFixed(1)}m, {activeModel.boundingBox.minZ.toFixed(1)}m]</div>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={handleFitSiteToModel}
                  className="w-full py-1.5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shadow transition-all"
                  title="Automatically calculate plot dimensions, origin, and setbacks to enclose the 3D building"
                >
                  <Maximize2 className="w-3 h-3" />
                  Fit Site Plan to 3D Model
                </button>
                <button
                  onClick={handleMoveModelToSite}
                  disabled={!validation.valid}
                  className="w-full py-1.5 px-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-40"
                  title="Shift the 3D structural building model coordinates into this site plan footprint"
                >
                  <Compass className="w-3 h-3" />
                  Move 3D Model into Site
                </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Plot Boundary</h3>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_LABELS.slice(0, 2).map((f) => (
                <Field key={f.key} label={f.label} unit={f.unit} value={Number(draft[f.key])} step={f.step}
                  onChange={(v) => updateField(f.key, v)} />
              ))}
              <Field label="Plot Origin X" unit="m" value={Number(draft.plotOriginX || 0)} step={0.5}
                onChange={(v) => updateField('plotOriginX', v)} />
              <Field label="Plot Origin Z" unit="m" value={Number(draft.plotOriginZ || 0)} step={0.5}
                onChange={(v) => updateField('plotOriginZ', v)} />
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Statutory Setbacks</h3>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_LABELS.slice(2, 6).map((f) => (
                <Field key={f.key} label={f.label} unit={f.unit} value={Number(draft[f.key])} step={f.step}
                  onChange={(v) => updateField(f.key, v)} />
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-[10px] text-slate-400 mb-1">Road Side</label>
              <div className="flex gap-1">
                {(['FRONT', 'BACK', 'LEFT', 'RIGHT'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDraft((p) => ({ ...p, roadSide: r }))}
                    className={`flex-1 px-1 py-1 rounded text-[10px] font-bold border transition-all ${
                      draft.roadSide === r
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Building Footprint</h3>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_LABELS.slice(6, 10).map((f) => (
                <Field key={f.key} label={f.label} unit={f.unit} value={Number(draft[f.key])} step={f.step}
                  onChange={(v) => updateField(f.key, v)} />
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-[10px] text-slate-400 mb-1">Rotation</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDraft((p) => ({ ...p, buildingRotation: ((p.buildingRotation + 90) % 360) as 0 | 90 | 180 | 270 }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-amber-400"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate {draft.buildingRotation}°
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ground &amp; Levels</h3>
            <Field label="Ground Level (PL)" unit="m" value={draft.groundElevation} step={0.1}
              onChange={(v) => updateField('groundElevation', v)} />
          </div>

          {!validation.valid && (
            <div className="px-3 py-2 rounded border border-red-800 bg-red-950/50 text-red-300 space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px]">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: SVG Preview + Metrics */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative bg-[#0b1120]">
            <svg
              viewBox={`${vbX0} ${vbZ0} ${vbW} ${vbH}`}
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background hatch for the plot interior */}
              <rect x={plotX0} y={plotZ0} width={draft.plotLength} height={draft.plotWidth} fill="#0f172a" stroke="#334155" strokeWidth={0.15} />
              {/* Road strip */}
              <polygon points={roadPoints} fill="#1e293b" stroke="#475569" strokeWidth={0.1} />
              <text x={(plotX0 + plotX1) / 2} y={roadSide === 'FRONT' ? plotZ0 - 0.45 : roadSide === 'BACK' ? plotZ1 + 0.75 : plotZ0 - 0.5}
                textAnchor="middle" fontSize={0.55} fill="#94a3b8" fontWeight="bold">ROAD</text>

              {/* Setback envelope (dashed) */}
              <rect
                x={plotX0 + draft.frontSetback}
                y={plotZ0 + draft.leftSetback}
                width={Math.max(0, draft.plotLength - draft.frontSetback - draft.rearSetback)}
                height={Math.max(0, draft.plotWidth - draft.leftSetback - draft.rightSetback)}
                fill="none" stroke="#059669" strokeWidth={0.12} strokeDasharray="0.4 0.3" />

              {/* 3D Structural Model Bounding Extents (if model exists) */}
              {activeModel && activeModel.nodes.size > 0 && (
                <g>
                  <rect
                    x={activeModel.boundingBox.minX}
                    y={activeModel.boundingBox.minZ}
                    width={Math.max(0.1, activeModel.boundingBox.maxX - activeModel.boundingBox.minX)}
                    height={Math.max(0.1, activeModel.boundingBox.maxZ - activeModel.boundingBox.minZ)}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    strokeWidth={0.14}
                    strokeDasharray="0.35 0.25"
                  />
                  <text
                    x={(activeModel.boundingBox.minX + activeModel.boundingBox.maxX) / 2}
                    y={(activeModel.boundingBox.minZ + activeModel.boundingBox.maxZ) / 2 - 0.2}
                    textAnchor="middle"
                    fontSize={0.45}
                    fill="#38bdf8"
                    fontWeight="bold"
                  >
                    3D MODEL EXTENTS
                  </text>
                  <text
                    x={(activeModel.boundingBox.minX + activeModel.boundingBox.maxX) / 2}
                    y={(activeModel.boundingBox.minZ + activeModel.boundingBox.maxZ) / 2 + 0.35}
                    textAnchor="middle"
                    fontSize={0.35}
                    fill="#7dd3fc"
                  >
                    {(activeModel.boundingBox.maxX - activeModel.boundingBox.minX).toFixed(1)} × {(activeModel.boundingBox.maxZ - activeModel.boundingBox.minZ).toFixed(1)} m
                  </text>
                </g>
              )}

              {/* Building footprint */}
              <path d={footPrintPath} fill="#2563eb" fillOpacity={0.55} stroke="#60a5fa" strokeWidth={0.2} />
              <text x={plotX0 + draft.buildingOffsetX + draft.buildingLength / 2}
                y={plotZ0 + draft.buildingOffsetZ + draft.buildingWidth / 2 + 0.2}
                textAnchor="middle" fontSize={0.6} fill="#dbeafe" fontWeight="bold">
                BUILDING
              </text>
              <text x={plotX0 + draft.buildingOffsetX + draft.buildingLength / 2}
                y={plotZ0 + draft.buildingOffsetZ + draft.buildingWidth / 2 - 0.35}
                textAnchor="middle" fontSize={0.5} fill="#93c5fd">
                {draft.buildingLength.toFixed(1)} × {draft.buildingWidth.toFixed(1)} m
              </text>

              {/* Plot dimension labels */}
              <text x={(plotX0 + plotX1) / 2} y={plotZ1 + 1.0} textAnchor="middle" fontSize={0.6} fill="#e2e8f0" fontWeight="bold">
                PLOT {draft.plotLength.toFixed(1)} × {draft.plotWidth.toFixed(1)} m
              </text>
              <text x={plotX1 + 0.9} y={(plotZ0 + plotZ1) / 2} textAnchor="middle" fontSize={0.55} fill="#64748b" transform={`rotate(90 ${plotX1 + 0.9} ${(plotZ0 + plotZ1) / 2})`}>
                {draft.plotWidth.toFixed(1)} m
              </text>

              {/* Setback annotations */}
              {draft.frontSetback > 0 && (
                <text x={(plotX0 + plotX0 + draft.frontSetback) / 2} y={plotZ0 - 0.5} textAnchor="middle" fontSize={0.42} fill="#34d399">
                  FR {draft.frontSetback.toFixed(1)}
                </text>
              )}
              {draft.rearSetback > 0 && (
                <text x={(plotX1 - draft.rearSetback + plotX1) / 2} y={plotZ0 - 0.5} textAnchor="middle" fontSize={0.42} fill="#34d399">
                  RR {draft.rearSetback.toFixed(1)}
                </text>
              )}
              {draft.leftSetback > 0 && (
                <text x={plotX0 - 0.5} y={(plotZ0 + plotZ0 + draft.leftSetback) / 2} textAnchor="middle" fontSize={0.42} fill="#34d399" transform={`rotate(-90 ${plotX0 - 0.5} ${(plotZ0 + plotZ0 + draft.leftSetback) / 2})`}>
                  LS {draft.leftSetback.toFixed(1)}
                </text>
              )}
              {draft.rightSetback > 0 && (
                <text x={plotX0 - 0.5} y={(plotZ1 - draft.rightSetback + plotZ1) / 2} textAnchor="middle" fontSize={0.42} fill="#34d399" transform={`rotate(-90 ${plotX0 - 0.5} ${(plotZ1 - draft.rightSetback + plotZ1) / 2})`}>
                  RS {draft.rightSetback.toFixed(1)}
                </text>
              )}

              {/* Compass */}
              <g transform={`translate(${plotX1 + 0.6} ${plotZ0 + 0.8})`}>
                <circle r={0.8} fill="#1e293b" stroke="#475569" strokeWidth={0.1} />
                <text x={0} y={-1.0} textAnchor="middle" fontSize={0.5} fill="#94a3b8">N</text>
                <path d="M0,0 L0.35,0.55 L0,0.25 L-0.35,0.55 Z" fill="#60a5fa" />
              </g>
            </svg>

            {/* Metric cards */}
            <div className="absolute top-3 left-3 grid grid-cols-2 md:grid-cols-4 gap-2 pointer-events-none">
              <MetricCard label="PLOT AREA" value={`${metrics.plotArea.toFixed(1)} m²`} accent="text-sky-400" />
              <MetricCard label="BUILDABLE AREA" value={`${metrics.buildableArea.toFixed(1)} m²`} accent="text-emerald-400" />
              <MetricCard label="FOOTPRINT" value={`${metrics.buildingFootprintArea.toFixed(1)} m²`} accent="text-blue-400" />
              <MetricCard label="GROUND COVERAGE" value={`${(metrics.groundCoverageRatio * 100).toFixed(1)}%`} accent="text-amber-400" />
            </div>
          </div>

          {/* Footer status strip */}
          <div className="h-9 bg-slate-900 border-t border-slate-800 px-4 flex items-center gap-3 text-[10px] text-slate-400">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Plot origin: ({plotX0.toFixed(1)}, {plotZ0.toFixed(1)}) m</span>
            <span>•</span>
            <span>Road: <strong className="text-amber-400">{roadSide}</strong></span>
            <span>•</span>
            <span>Ground level: <strong className="text-slate-200">{draft.groundElevation.toFixed(2)} m</strong></span>
            <span className="ml-auto flex items-center gap-1.5">
              {validation.valid ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400 font-bold">Ready for Architectural Plan</span></>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-bold">Fix errors to continue</span></>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  unit: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, unit, value, step, onChange }) => (
  <div>
    <label className="block text-[10px] text-slate-400 mb-1 truncate">{label}</label>
    <div className="flex items-center bg-slate-950 border border-slate-700 rounded focus-within:border-slate-500">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full bg-transparent px-2 py-1.5 text-[12px] text-slate-100 outline-none"
      />
      <span className="px-1.5 text-[10px] text-slate-500">{unit}</span>
    </div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-sm">
    <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
    <div className={`text-sm font-bold font-mono ${accent}`}>{value}</div>
  </div>
);

export default PlotAreaView;