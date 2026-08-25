import React, { useState, useMemo, useEffect } from 'react';
import { MasterShearWallOutput, MasterShearWallInput, ShearWallEngine } from './shearWallEngine';
import { X, Sparkles, CheckCircle2, AlertTriangle, Wrench, ShieldCheck, Layers, RotateCcw, Save } from 'lucide-react';

interface ShearWallEditModalProps {
  wall: MasterShearWallOutput | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (wallId: number, overrides: Partial<MasterShearWallInput>) => void;
  onReset: (wallId: number) => void;
}

export const ShearWallEditModal: React.FC<ShearWallEditModalProps> = ({
  wall,
  isOpen,
  onClose,
  onSave,
  onReset,
}) => {
  if (!isOpen || !wall) return null;

  // Form State initialized from current wall design
  const [thickness, setThickness] = useState<number>(wall.thickness || 230);
  const [length, setLength] = useState<number>(wall.length || 3.2);
  const [height, setHeight] = useState<number>(wall.height || 3.5);
  const [fck, setFck] = useState<number>(wall.input?.fck || 25);
  const [fy, setFy] = useState<number>(wall.input?.fy || 500);

  // Web Reinforcement
  const [webVertDia, setWebVertDia] = useState<number>(wall.result?.webVerticalDia || 10);
  const [webVertSpacing, setWebVertSpacing] = useState<number>(wall.result?.webVerticalSpacing || 150);
  const [webHorizDia, setWebHorizDia] = useState<number>(wall.result?.webHorizontalDia || 10);
  const [webHorizSpacing, setWebHorizSpacing] = useState<number>(wall.result?.webHorizontalSpacing || 150);
  const [webCurtains, setWebCurtains] = useState<number>(wall.result?.webCurtains || 2);

  // Boundary Element
  const [boundaryLength, setBoundaryLength] = useState<number>(wall.result?.boundary?.boundaryLength || Math.round(0.15 * (wall.length || 3.2) * 1000));
  const [boundaryBarCount, setBoundaryBarCount] = useState<number>(wall.result?.boundary?.longitudinalBarCount || 8);
  const [boundaryBarDia, setBoundaryBarDia] = useState<number>(wall.result?.boundary?.longitudinalBarDia || 16);
  const [boundaryTieDia, setBoundaryTieDia] = useState<number>(wall.result?.boundary?.confiningHoopDia || 8);
  const [boundaryTieSpacing, setBoundaryTieSpacing] = useState<number>(wall.result?.boundary?.confiningHoopSpacing || 100);

  // Reset form when wall changes
  useEffect(() => {
    if (wall) {
      setThickness(wall.thickness || 230);
      setLength(wall.length || 3.2);
      setHeight(wall.height || 3.5);
      setFck(wall.input?.fck || 25);
      setFy(wall.input?.fy || 500);
      setWebVertDia(wall.result?.webVerticalDia || 10);
      setWebVertSpacing(wall.result?.webVerticalSpacing || 150);
      setWebHorizDia(wall.result?.webHorizontalDia || 10);
      setWebHorizSpacing(wall.result?.webHorizontalSpacing || 150);
      setWebCurtains(wall.result?.webCurtains || 2);
      setBoundaryLength(wall.result?.boundary?.boundaryLength || Math.round(0.15 * (wall.length || 3.2) * 1000));
      setBoundaryBarCount(wall.result?.boundary?.longitudinalBarCount || 8);
      setBoundaryBarDia(wall.result?.boundary?.longitudinalBarDia || 16);
      setBoundaryTieDia(wall.result?.boundary?.confiningHoopDia || 8);
      setBoundaryTieSpacing(wall.result?.boundary?.confiningHoopSpacing || 100);
    }
  }, [wall]);

  // Live Recalculation preview as parameters are edited
  const previewResult = useMemo(() => {
    const input: MasterShearWallInput = {
      wallId: wall.wallId,
      length,
      thickness,
      height,
      fck,
      fy,
      Pu: typeof wall.input?.Pu === 'number' && !isNaN(wall.input?.Pu) ? wall.input.Pu : 1200,
      Vu: typeof wall.input?.Vu === 'number' && !isNaN(wall.input?.Vu) ? wall.input.Vu : 220,
      Mu: typeof wall.input?.Mu === 'number' && !isNaN(wall.input?.Mu) ? wall.input.Mu : 450,
      governingLoadCase: wall.governingLoadCase,
      customWebVerticalDia: webVertDia,
      customWebVerticalSpacing: webVertSpacing,
      customWebHorizontalDia: webHorizDia,
      customWebHorizontalSpacing: webHorizSpacing,
      customWebCurtains: webCurtains,
      customBoundaryLength: boundaryLength,
      customBoundaryBarCount: boundaryBarCount,
      customBoundaryBarDia: boundaryBarDia,
      customBoundaryTieDia: boundaryTieDia,
      customBoundaryTieSpacing: boundaryTieSpacing,
    };
    return ShearWallEngine.design(input);
  }, [
    wall,
    length,
    thickness,
    height,
    fck,
    fy,
    webVertDia,
    webVertSpacing,
    webHorizDia,
    webHorizSpacing,
    webCurtains,
    boundaryLength,
    boundaryBarCount,
    boundaryBarDia,
    boundaryTieDia,
    boundaryTieSpacing,
  ]);

  const handleApplyAutoFix = () => {
    const fixed = ShearWallEngine.autoFix({
      wallId: wall.wallId,
      length,
      thickness,
      height,
      fck,
      fy,
      Pu: typeof wall.input?.Pu === 'number' && !isNaN(wall.input?.Pu) ? wall.input.Pu : 1200,
      Vu: typeof wall.input?.Vu === 'number' && !isNaN(wall.input?.Vu) ? wall.input.Vu : 220,
      Mu: typeof wall.input?.Mu === 'number' && !isNaN(wall.input?.Mu) ? wall.input.Mu : 450,
      governingLoadCase: wall.governingLoadCase,
    });

    setThickness(fixed.fixedInput.thickness);
    setFck(fixed.fixedInput.fck);
    if (fixed.fixedInput.customWebVerticalDia) setWebVertDia(fixed.fixedInput.customWebVerticalDia);
    if (fixed.fixedInput.customWebVerticalSpacing) setWebVertSpacing(fixed.fixedInput.customWebVerticalSpacing);
    if (fixed.fixedInput.customWebHorizontalDia) setWebHorizDia(fixed.fixedInput.customWebHorizontalDia);
    if (fixed.fixedInput.customWebHorizontalSpacing) setWebHorizSpacing(fixed.fixedInput.customWebHorizontalSpacing);
    if (fixed.fixedInput.customBoundaryBarCount) setBoundaryBarCount(fixed.fixedInput.customBoundaryBarCount);
    if (fixed.fixedInput.customBoundaryBarDia) setBoundaryBarDia(fixed.fixedInput.customBoundaryBarDia);
    if (fixed.fixedInput.customBoundaryTieSpacing) setBoundaryTieSpacing(fixed.fixedInput.customBoundaryTieSpacing);
  };

  const handleSave = () => {
    onSave(wall.wallId, {
      length,
      thickness,
      height,
      fck,
      fy,
      customWebVerticalDia: webVertDia,
      customWebVerticalSpacing: webVertSpacing,
      customWebHorizontalDia: webHorizDia,
      customWebHorizontalSpacing: webHorizSpacing,
      customWebCurtains: webCurtains,
      customBoundaryLength: boundaryLength,
      customBoundaryBarCount: boundaryBarCount,
      customBoundaryBarDia: boundaryBarDia,
      customBoundaryTieDia: boundaryTieDia,
      customBoundaryTieSpacing: boundaryTieSpacing,
    });
    onClose();
  };

  const isPass = previewResult.status === 'PASS';
  const isWarn = previewResult.status === 'WARNING';

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 to-rose-950 text-white flex items-center justify-between border-b border-rose-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-600 rounded-md">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                <span>EDIT DUCTILE SHEAR WALL SW-{wall.wallId}</span>
                <span className="px-2 py-0.2 bg-rose-900/80 text-rose-200 border border-rose-600 rounded text-[10px] font-mono">
                  IS 13920:2016 &amp; IS 456
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 font-sans">
                Manually configure cross-section dimensions, web double-curtain meshes, boundary zones, and special confining hoops.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
          {/* Live Engineering Status Card */}
          <div className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
            isPass
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : isWarn
              ? 'bg-amber-50/70 border-amber-300 text-amber-950'
              : 'bg-rose-50/70 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded font-bold text-xs ${
                  isPass ? 'bg-emerald-600 text-white' : isWarn ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {previewResult.status}
                </span>
                <span className="font-bold text-xs">
                  {isPass ? 'Code Requirements Fully Satisfied' : previewResult.result.failureReason || 'Design Issues Detected'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAutoFix}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold shadow-xs text-[11px] transition-all"
                title="1-Click Auto-Fix to IS 13920 optimal dimensions & rebar"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>⚡ 1-Click Auto-Fix</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white/90 p-2.5 rounded border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px]">SHEAR STRESS τv:</span>
                <strong className={previewResult.result.nominalShearStress <= previewResult.result.tau_c_max ? 'text-slate-900' : 'text-rose-700 font-bold'}>
                  {previewResult.result.nominalShearStress} N/mm²
                </strong>
                <span className="text-[10px] text-slate-500 block">Limit: {previewResult.result.tau_c_max} N/mm²</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">BOUNDARY STRESS σc:</span>
                <strong className="text-slate-900">
                  {previewResult.result.boundary.extremeFiberStress} N/mm²
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  {previewResult.result.boundary.isBoundaryElementRequired ? 'Triggered (> 0.2 fck)' : 'Not Required'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">WEB STEEL RATIO:</span>
                <strong className={previewResult.result.webSteelPercentage >= 0.25 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {previewResult.result.webSteelPercentage}% vert / {previewResult.result.webHorizSteelPercentage}% horiz
                </strong>
                <span className="text-[10px] text-slate-500 block">Min: 0.25% (IS 13920)</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">BOUNDARY STEEL:</span>
                <strong className="text-slate-900">
                  {previewResult.result.boundary.providedLongitudinalSteel} mm²
                </strong>
                <span className="text-[10px] text-slate-500 block">Min: {previewResult.result.boundary.minLongitudinalSteel} mm² (0.8%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Section Geometry & Materials */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3 font-sans">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 border-b pb-1.5 border-slate-200">
                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. SECTION &amp; GRADES</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Thickness tw (mm):
                  </label>
                  <input
                    type="number"
                    step="25"
                    min="150"
                    max="600"
                    value={thickness}
                    onChange={(e) => setThickness(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Min code: {previewResult.result.minThicknessRequired} mm</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Length Lw (m):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="15.0"
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Height Hw (m):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="2.0"
                    max="10.0"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                      Concrete fck:
                    </label>
                    <select
                      value={fck}
                      onChange={(e) => setFck(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs"
                    >
                      <option value={25}>M25</option>
                      <option value={30}>M30</option>
                      <option value={35}>M35</option>
                      <option value={40}>M40</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                      Steel fy:
                    </label>
                    <select
                      value={fy}
                      onChange={(e) => setFy(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs"
                    >
                      <option value={500}>Fe500D</option>
                      <option value={550}>Fe550D</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Web Reinforcement */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3 font-sans">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 border-b pb-1.5 border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. WEB REBAR MESH</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Vertical Bar Dia &amp; Spacing:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={webVertDia}
                      onChange={(e) => setWebVertDia(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    >
                      <option value={8}>T8</option>
                      <option value={10}>T10</option>
                      <option value={12}>T12</option>
                      <option value={16}>T16</option>
                    </select>
                    <input
                      type="number"
                      step="25"
                      min="75"
                      max="300"
                      value={webVertSpacing}
                      onChange={(e) => setWebVertSpacing(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                      title="Spacing in mm c/c"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Horizontal Bar Dia &amp; Spacing:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={webHorizDia}
                      onChange={(e) => setWebHorizDia(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    >
                      <option value={8}>T8</option>
                      <option value={10}>T10</option>
                      <option value={12}>T12</option>
                      <option value={16}>T16</option>
                    </select>
                    <input
                      type="number"
                      step="25"
                      min="75"
                      max="300"
                      value={webHorizSpacing}
                      onChange={(e) => setWebHorizSpacing(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                      title="Spacing in mm c/c"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Curtains / Layers:
                  </label>
                  <select
                    value={webCurtains}
                    onChange={(e) => setWebCurtains(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                  >
                    <option value={2}>2-Curtains (Double Layer - Code Mandate)</option>
                    <option value={1}>1-Curtain (Single Layer)</option>
                  </select>
                </div>

                <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-[10px] text-emerald-900 font-mono">
                  {previewResult.result.webVerticalRebar}
                </div>
              </div>
            </div>

            {/* 3. Boundary Element Detailing */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3 font-sans">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 border-b pb-1.5 border-slate-200">
                <Layers className="w-3.5 h-3.5 text-rose-600" />
                <span>3. BOUNDARY ELEMENT</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Boundary Zone Length c (mm):
                  </label>
                  <input
                    type="number"
                    step="25"
                    min="200"
                    max="2000"
                    value={boundaryLength}
                    onChange={(e) => setBoundaryLength(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Min: {Math.max(250, Math.round(0.15 * length * 1000))} mm</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Vertical Bars (Count &amp; Dia):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="2"
                      min="4"
                      max="32"
                      value={boundaryBarCount}
                      onChange={(e) => setBoundaryBarCount(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                      title="Number of bars"
                    />
                    <select
                      value={boundaryBarDia}
                      onChange={(e) => setBoundaryBarDia(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    >
                      <option value={12}>T12</option>
                      <option value={16}>T16</option>
                      <option value={20}>T20</option>
                      <option value={25}>T25</option>
                      <option value={32}>T32</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 font-mono">
                    Confining Ties (Dia &amp; Spacing):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={boundaryTieDia}
                      onChange={(e) => setBoundaryTieDia(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    >
                      <option value={8}>8 mm</option>
                      <option value={10}>10 mm</option>
                      <option value={12}>12 mm</option>
                    </select>
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="150"
                      value={boundaryTieSpacing}
                      onChange={(e) => setBoundaryTieSpacing(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                      title="Hoop spacing in mm"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Max code spacing: {Math.min(100, Math.floor(thickness / 2), 6 * boundaryBarDia)} mm
                  </span>
                </div>

                <div className={`p-2 rounded border text-[10px] font-mono ${
                  previewResult.result.boundary.isBoundaryElementRequired
                    ? previewResult.result.boundary.status === 'PASS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  <div className="font-bold">
                    {previewResult.result.boundary.isBoundaryElementRequired
                      ? `Boundary Element Required (σc = ${previewResult.result.boundary.extremeFiberStress} N/mm² > 0.2 fck = ${previewResult.result.boundary.stressLimit} N/mm²)`
                      : `Boundary Element Not Required (σc = ${previewResult.result.boundary.extremeFiberStress} N/mm² ≤ 0.2 fck = ${previewResult.result.boundary.stressLimit} N/mm²)`
                    }
                  </div>
                  <div className="mt-0.5">{previewResult.result.boundary.recommendedRebarCallout}</div>
                  <div className="text-slate-500 mt-0.5">{previewResult.result.boundary.confiningHoopCallout}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onReset(wall.wallId);
                onClose();
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Auto</span>
            </button>
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              IS 13920:2016 Cl. 9 &amp; Cl. 10 Compliance Engine
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold rounded shadow transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Apply Wall Design</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
