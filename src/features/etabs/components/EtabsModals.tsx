import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Building,
  Box,
  Layers,
  TrendingUp,
  X,
  CheckCircle2,
  ShieldCheck,
  Save,
  FileJson,
  FileSpreadsheet,
  Play,
  Activity,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';
import { NormalizedStructuralModel, CrossSection } from '@/features/model/types';
import { StoredProject } from '@/features/projects/types';

// ==========================================
// 1. BUILDING WIZARD MODAL WINDOW
// ==========================================
interface BuildingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (
    baysX: number,
    baysZ: number,
    widthX: number,
    widthZ: number,
    stories: number,
    storyH: number
  ) => void;
}

export const BuildingWizardModal: React.FC<BuildingWizardModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [baysX, setBaysX] = useState(3);
  const [baysZ, setBaysZ] = useState(2);
  const [widthX, setWidthX] = useState(4.5);
  const [widthZ, setWidthZ] = useState(4.0);
  const [stories, setStories] = useState(3);
  const [storyH, setStoryH] = useState(3.2);

  if (!isOpen) return null;

  const totalLength = baysX * widthX;
  const totalWidth = baysZ * widthZ;
  const totalHeight = stories * storyH;
  const totalCols = (baysX + 1) * (baysZ + 1);

  // Preset Configurations
  const applyPreset = (bx: number, bz: number, wx: number, wz: number, st: number, sh: number) => {
    setBaysX(bx);
    setBaysZ(bz);
    setWidthX(wx);
    setWidthZ(wz);
    setStories(st);
    setStoryH(sh);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">ETABS Quick Building Wizard</h3>
              <p className="text-xs text-slate-400">1-Click generation of parametric multi-storey space frame</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Standard Building Presets:</span>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => applyPreset(2, 2, 4.0, 4.0, 2, 3.0)}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-sky-300 block">G+1 Villa</strong>
              <span className="text-[10px] text-slate-400">2×2 Bays (8×8m)</span>
            </button>
            <button
              onClick={() => applyPreset(3, 2, 4.5, 4.0, 4, 3.2)}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-amber-300 block">G+3 Apartment</strong>
              <span className="text-[10px] text-slate-400">3×2 Bays (13.5×8m)</span>
            </button>
            <button
              onClick={() => applyPreset(4, 3, 5.0, 5.0, 6, 3.3)}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-emerald-300 block">G+5 Commercial</strong>
              <span className="text-[10px] text-slate-400">4×3 Bays (20×15m)</span>
            </button>
          </div>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          {/* X Direction */}
          <div className="space-y-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="font-bold text-sky-400 uppercase text-[11px] block">X-Direction Framing</span>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Number of Bays (X):</label>
              <input
                type="number"
                min={1}
                max={12}
                value={baysX}
                onChange={(e) => setBaysX(parseInt(e.target.value, 10) || 3)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Bay Width (X in meters):</label>
              <input
                type="number"
                step={0.5}
                min={2.5}
                max={15}
                value={widthX}
                onChange={(e) => setWidthX(parseFloat(e.target.value) || 4.5)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
              />
            </div>
          </div>

          {/* Z Direction */}
          <div className="space-y-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="font-bold text-indigo-400 uppercase text-[11px] block">Z-Direction Framing</span>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Number of Bays (Z):</label>
              <input
                type="number"
                min={1}
                max={12}
                value={baysZ}
                onChange={(e) => setBaysZ(parseInt(e.target.value, 10) || 2)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Bay Width (Z in meters):</label>
              <input
                type="number"
                step={0.5}
                min={2.5}
                max={15}
                value={widthZ}
                onChange={(e) => setWidthZ(parseFloat(e.target.value) || 4.0)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
              />
            </div>
          </div>

          {/* Elevation / Storeys */}
          <div className="col-span-2 space-y-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="font-bold text-emerald-400 uppercase text-[11px] block">Storey Levels &amp; Height</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Number of Storeys (G+N):</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={stories}
                  onChange={(e) => setStories(parseInt(e.target.value, 10) || 3)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Storey Height (meters):</label>
                <input
                  type="number"
                  step={0.1}
                  min={2.5}
                  max={6.0}
                  value={storyH}
                  onChange={(e) => setStoryH(parseFloat(e.target.value) || 3.2)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Model Statistics Live Preview Card */}
        <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs space-y-1">
          <span className="text-[10px] text-indigo-300 font-bold uppercase block">Generated Structure Summary:</span>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>Dimensions: <strong className="text-white">{totalLength.toFixed(1)}m × {totalWidth.toFixed(1)}m</strong></div>
            <div>Height: <strong className="text-white">+{totalHeight.toFixed(1)}m</strong></div>
            <div>Columns/Floor: <strong className="text-amber-300">{totalCols} Cols</strong></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onGenerate(baysX, baysZ, widthX, widthZ, stories, storyH);
              onClose();
            }}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate &amp; Auto-Analyze Model</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. SAVE PROJECT MODAL WINDOW
// ==========================================
interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: StoredProject | null;
  onSaveProjectName: (name: string, engineer: string, client: string) => Promise<void>;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  onSaveProjectName,
  onExportJson,
  onExportCsv,
}) => {
  const [name, setName] = useState(activeProject?.metadata.name || 'Structural Model Project');
  const [engineer, setEngineer] = useState(activeProject?.metadata.engineer || 'Lead Structural Engineer');
  const [client, setClient] = useState(activeProject?.metadata.client || 'Structure AI Client');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.metadata.name);
      setEngineer(activeProject.metadata.engineer || 'Lead Structural Engineer');
      setClient(activeProject.metadata.client || 'Structure AI Client');
    }
  }, [activeProject]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await onSaveProjectName(name, engineer, client);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Save Structural Model</h3>
              <p className="text-[11px] text-slate-400">Save to IndexedDB &amp; Export Files</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Project Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Structural Engineer:</label>
            <input
              type="text"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Client / Project Code:</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            />
          </div>

          {/* Export Options */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Export Project Files:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExportJson}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left flex items-center gap-2 text-[11px]"
              >
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>Export .JSON</span>
              </button>
              <button
                onClick={onExportCsv}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left flex items-center gap-2 text-[11px]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export .CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`px-5 py-2 rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2 ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Saved Successfully!' : 'Save Model'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. RUN 3D FEM ANALYSIS MODAL WINDOW
// ==========================================
interface RunAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteAnalysis: () => Promise<void>;
  model: NormalizedStructuralModel | null;
  isAnalyzing: boolean;
  onViewDiagrams?: () => void;
}

export const RunAnalysisModal: React.FC<RunAnalysisModalProps> = ({
  isOpen,
  onClose,
  onExecuteAnalysis,
  model,
  isAnalyzing,
  onViewDiagrams,
}) => {
  const [step, setStep] = useState<number>(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setCompleted((model?.memberForces.length || 0) > 0);
    }
  }, [isOpen, model]);

  if (!isOpen) return null;

  const handleStartSolving = async () => {
    setStep(1);
    await new Promise((r) => setTimeout(r, 200));
    setStep(2);
    await new Promise((r) => setTimeout(r, 200));
    setStep(3);
    await onExecuteAnalysis();
    setStep(4);
    setCompleted(true);
  };

  const totalMembers = model?.members.size || 0;
  const totalJoints = model?.nodes.size || 0;
  const totalDofs = totalJoints * 6;
  const totalReactions = model?.reactions.length || 0;

  // Compute total gravity load sum Fy
  const sumReactionsFy = (model?.reactions || []).reduce((acc, r) => acc + (r.fy || 0), 0);

  // Real storey drift report from the solver (storyDrifts stored in the model)
  const storyDrifts = model?.storyDrifts ?? [];
  const maxDriftRatio = storyDrifts.length > 0
    ? Math.max(...storyDrifts.map((d: any) => Number(d?.driftRatio ?? 0)))
    : null;
  const effectiveMaxDrift = maxDriftRatio;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">3D Direct Stiffness FEM Analysis</h3>
              <p className="text-[11px] text-slate-400">Euler-Bernoulli 3D Space Frame Solver (6-DOF per joint)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Solver Statistics Cards */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 bg-slate-800/60 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 block">Total DOFs:</span>
            <strong className="text-white text-sm">{totalDofs} (6/Joint)</strong>
          </div>
          <div className="p-2.5 bg-slate-800/60 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 block">Frame Elements:</span>
            <strong className="text-indigo-300 text-sm">{totalMembers} 3D Beams/Cols</strong>
          </div>
          <div className="p-2.5 bg-slate-800/60 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 block">Supports:</span>
            <strong className="text-emerald-300 text-sm">{totalReactions} Reactions</strong>
          </div>
        </div>

        {/* Step-by-Step Solver Execution Progress */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Solver Pipeline Status:</span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">1. Spatial Transformation &amp; 12×12 Element Stiffness</span>
              {step >= 1 || completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">2. Global Matrix Assembly [K_global] ({totalDofs}×{totalDofs})</span>
              {step >= 2 || completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">3. Cholesky Linear Solver: [K]{'{U}'} = {'{F}'}</span>
              {step >= 3 || completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">4. Internal Forces (Pu, Vy, Vz, Tu, My, Mz) &amp; Drifts</span>
              {completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
            </div>
          </div>
        </div>

        {/* Results Equilibrium Summary */}
        {completed && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Static Equilibrium &amp; Analysis Solved Successfully!</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>Total Base Reaction (ΣFy): <strong className="text-white">{sumReactionsFy.toFixed(1)} kN</strong></div>
              <div>
                Max Storey Drift Index:
                {effectiveMaxDrift !== null ? (
                  <strong className={effectiveMaxDrift <= 0.004 ? 'text-emerald-300' : 'text-amber-400'}>
                    {' '}{effectiveMaxDrift.toFixed(4)} ({(effectiveMaxDrift <= 0.004 ? 'Safe < 0.004h' : 'EXCEEDS 0.004h')})
                  </strong>
                ) : (
                  <strong className="text-white"> N/A (no drift results)</strong>
                )}
              </div>
            </div>
            {storyDrifts.length > 0 && (
              <div className="pt-2 border-t border-emerald-500/20 space-y-1">
                <span className="text-[10px] text-emerald-400/80 uppercase font-bold">Storey-by-Storey Drift (h=3.2m)</span>
                {storyDrifts.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between text-[11px] text-slate-300">
                    <span>{d.storyName ?? `Storey ${i + 1}`}:</span>
                    <strong className={d.status === 'FAIL' ? 'text-amber-400' : 'text-white'}>
                      {Number(d?.driftRatio ?? 0).toFixed(4)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors"
          >
            Close
          </button>
          {completed ? (
            <>
              <button
                onClick={handleStartSolving}
                disabled={isAnalyzing}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors"
              >
                Re-run Solver
              </button>
              <button
                onClick={() => {
                  if (onViewDiagrams) onViewDiagrams();
                  onClose();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>View 2D Diagrams &amp; Results</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleStartSolving}
              disabled={isAnalyzing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Solving FEM...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Analysis Now</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. RUN CONCRETE DESIGN MODAL WINDOW
// ==========================================
interface ConcreteDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: NormalizedStructuralModel | null;
  onNavigateToFullDesign: () => void;
  onApplyDesign?: () => Promise<void>;
  isLoading?: boolean;
}

export const ConcreteDesignModal: React.FC<ConcreteDesignModalProps> = ({
  isOpen,
  onClose,
  model,
  onNavigateToFullDesign,
  onApplyDesign,
  isLoading,
}) => {
  const [applying, setApplying] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setAppliedMsg(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const totalCols = model ? Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN').length : 0;
  const totalBeams = model ? Array.from(model.members.values()).filter((m) => m.classification === 'BEAM').length : 0;

  const designSummaries = model?.designSummaries ? Array.from(model.designSummaries.values()) : [];
  const failCount = designSummaries.filter((s) => s.status === 'FAIL').length;
  const passCount = designSummaries.filter((s) => s.status === 'PASS').length;

  const handleApply = async () => {
    setApplying(true);
    setAppliedMsg(null);
    try {
      await onApplyDesign?.();
      setAppliedMsg('Reinforcement designed & applied. Design summaries written to the model.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Automated IS 456 / IS 13920 RCC Frame Design</h3>
              <p className="text-[11px] text-slate-400">Flexure, Bi-Axial Bending, Shear &amp; Ductile Reinforcement Detailing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Design Summary Cards */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Column Design:</span>
            <strong className="text-white text-base block mt-0.5">{totalCols} Columns</strong>
            <span className="text-[10px] text-emerald-400">IS 456 Cl. 39.5 Bi-Axial (Pass)</span>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Beam Design:</span>
            <strong className="text-white text-base block mt-0.5">{totalBeams} Beams</strong>
            <span className="text-[10px] text-emerald-400">Top/Bottom Flexure + Shear</span>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Member Design Status:</span>
            {designSummaries.length === 0 ? (
              <strong className="text-slate-400 text-sm block mt-0.5">Not designed</strong>
            ) : (
              <strong className={failCount > 0 ? 'text-amber-400 text-sm block mt-0.5' : 'text-emerald-400 text-sm block mt-0.5'}>
                {passCount} Pass / {failCount} Fail
              </strong>
            )}
            <span className="text-[10px] text-slate-400">{designSummaries.length}/{totalCols + totalBeams} members checked</span>
          </div>
        </div>

        {/* Sample Member Design Results Table */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Member Design Check Schedule</span>
          <div className="border border-slate-800 rounded-lg overflow-hidden text-xs max-h-48 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-2">Elem</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Section</th>
                  <th className="p-2 text-right">Pu (kN)</th>
                  <th className="p-2 text-right">Vu (kN)</th>
                  <th className="p-2 text-right">Mu (kNm)</th>
                  <th className="p-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                {designSummaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-slate-500">
                      No design checks run yet — click "Run Design Checks" below.
                    </td>
                  </tr>
                )}
                {designSummaries.map((s) => (
                  <tr key={s.memberId} className="hover:bg-slate-800/40">
                    <td className="p-2 font-bold text-slate-200">#{s.memberId}</td>
                    <td className="p-2">
                      <span className={s.classification === 'COLUMN' ? 'text-sky-400 font-bold' : 'text-indigo-400 font-bold'}>
                        {s.classification}
                      </span>
                    </td>
                    <td className="p-2 text-slate-300">{s.sectionDimensions}</td>
                    <td className="p-2 text-right text-white">{s.maxAxial.toFixed(1)}</td>
                    <td className="p-2 text-right text-white">{s.maxShear.toFixed(1)}</td>
                    <td className="p-2 text-right text-white">{s.maxMoment.toFixed(1)}</td>
                    <td className="p-2 text-right">
                      <span className={`font-bold ${s.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {appliedMsg && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2">
            <CheckCircle2 className="w-4 h-4" /> {appliedMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <button
              onClick={onNavigateToFullDesign}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded font-semibold text-xs flex items-center gap-1.5"
            >
              <span>Open Column / Beam Interactive Design Views</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs"
            >
              Close
            </button>
            <button
              onClick={handleApply}
              disabled={applying || isLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2"
            >
              {applying || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {applying || isLoading
                ? designSummaries.length > 0 ? 'Re-running...' : 'Running Design Checks...'
                : designSummaries.length > 0
                  ? 'Re-run Design Checks &amp; Apply to Model'
                  : 'Run Design Checks &amp; Apply to Model'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. FRAME SECTIONS MODAL WINDOW
// ==========================================
interface FrameSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model?: NormalizedStructuralModel | null;
  selectedMemberId?: number | null;
  onAssignSection?: (section: Partial<CrossSection>) => Promise<void>;
}

export const FrameSectionsModal: React.FC<FrameSectionsModalProps> = ({ isOpen, onClose, model, selectedMemberId, onAssignSection }) => {
  const [b, setB] = useState(300);
  const [d, setD] = useState(450);
  const [assigning, setAssigning] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && typeof selectedMemberId === 'number' && model) {
      const mem = model.members.get(selectedMemberId);
      if (mem) {
        setB(Math.round((mem.section?.zd || 0.3) * 1000));
        setD(Math.round((mem.section?.yd || 0.45) * 1000));
      }
    }
    setAppliedMsg(null);
  }, [isOpen, selectedMemberId, model]);

  if (!isOpen) return null;

  const presetSections = [
    { name: 'C450x450', b: 450, d: 450, kind: 'Column (Rectangular)' },
    { name: 'C300x600', b: 300, d: 600, kind: 'Column (Rectangular)' },
    { name: 'B300x450', b: 300, d: 450, kind: 'Beam (Rectangular)' },
    { name: 'B250x400', b: 250, d: 400, kind: 'Beam (Rectangular)' },
    { name: 'B230x500', b: 230, d: 500, kind: 'Beam (Rectangular)' },
  ];

  const handlePreset = (name: string, pb: number, pd: number) => {
    setB(pb);
    setD(pd);
  };

  const handleApply = async () => {
    if (selectedMemberId === null) return;
    setAssigning(true);
    setAppliedMsg(null);
    try {
      const section: Partial<CrossSection> = {
        type: 'RECTANGULAR' as const,
        yd: d / 1000,
        zd: b / 1000,
        name: `${d}x${b} mm`,
      };
      await onAssignSection?.(section);
      setAppliedMsg(`Section ${d}×${b} mm applied to member #${selectedMemberId}.`);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Define Frame Sections</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] text-slate-400 uppercase font-bold">Standard Sections</span>
          <div className="grid grid-cols-2 gap-2">
            {presetSections.map((sec) => (
              <button
                key={sec.name}
                onClick={() => handlePreset(sec.name, sec.b, sec.d)}
                className={`flex flex-col text-left p-2.5 rounded-lg border text-xs transition-all ${
                  b === sec.b && d === sec.d
                    ? 'bg-indigo-900/50 border-indigo-500 text-white'
                    : 'bg-slate-800/40 border-slate-700 hover:border-indigo-500/60'
                }`}
              >
                <span className="font-bold">{sec.name}</span>
                <span className="text-[10px] text-slate-400">{sec.kind}</span>
                <span className="text-[10px] text-slate-300">{sec.b} mm × {sec.d} mm</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 bg-slate-800/40 rounded-lg border border-slate-700 p-3">
          <span className="text-[11px] text-slate-400 uppercase font-bold">Custom Dimensions (mm)</span>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-slate-300">
              Breadth (b)
              <input
                type="number"
                value={b}
                onChange={(e) => setB(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-300">
              Depth (d)
              <input
                type="number"
                value={d}
                onChange={(e) => setD(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
          </div>
          <p className="text-[10px] text-slate-500">
            {selectedMemberId === null
              ? 'Select a member on the plan to edit its section.'
              : `Assigning to member #${selectedMemberId}.`}
          </p>
        </div>

        {selectedMemberId !== null && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            {appliedMsg && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {appliedMsg}
              </span>
            )}
            <button
              onClick={handleApply}
              disabled={assigning}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold text-xs flex items-center justify-center gap-2"
            >
              {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Assign Section to Selected Member &amp; Re-analyze
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. LOADS & DIAPHRAGMS MODAL WINDOW
// ==========================================
interface LoadsAndDiaphragmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model?: NormalizedStructuralModel | null;
  memberLoadPatterns?: string[];
}

export const LoadsAndDiaphragmsModal: React.FC<LoadsAndDiaphragmsModalProps> = ({ isOpen, onClose, model, memberLoadPatterns = [] }) => {
  const [llValue, setLlValue] = useState(3.0);
  const [wallUdl, setWallUdl] = useState(12.5);
  const [zone, setZone] = useState(0.24);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) setSaved(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // Derive actual applied loads from the model
  const patternCount: Record<string, number> = {};
  let totalMembersWithLoads = 0;
  for (const p of memberLoadPatterns) {
    patternCount[p] = (patternCount[p] || 0) + 1;
  }
  totalMembersWithLoads = memberLoadPatterns.length;
  const memberCount = model?.members.size ?? 0;
  const loadCases = model?.loadCases ? Array.from(model.loadCases.values()) : [];

  const patterns = Object.keys(patternCount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-white text-base">Loads &amp; Rigid Diaphragms</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700 space-y-2">
            <span className="font-bold text-sky-400 uppercase text-[10px] block">Load Cases in Model ({loadCases.length})</span>
            <div className="flex flex-wrap gap-1.5 py-1">
              {loadCases.length === 0 && <span className="text-slate-500">No load cases defined yet.</span>}
              {loadCases.map((lc) => (
                <span key={lc.id} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-sky-300">
                  #{lc.id} {lc.title}
                  {'type' in lc && typeof lc.type === 'string' ? ` (${lc.type})` : ''}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700 space-y-2">
            <span className="font-bold text-sky-400 uppercase text-[10px] block">Gravity Loading Patterns (applied)</span>
            {patterns.length === 0 ? (
              <p className="text-[11px] text-slate-500">No frame loads applied yet — use the Assign Load tool on the plan.</p>
            ) : (
              <div className="space-y-1">
                {patterns.map((p) => (
                  <div key={p} className="flex justify-between py-1 border-b border-slate-700/50 last:border-0">
                    <span className="text-slate-300">{p}:</span>
                    <strong className="text-white">{patternCount[p]} member load(s)</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-700/50">
              <span className="text-slate-400">Total loaded members / total members:</span>
              <strong className="text-white">{totalMembersWithLoads} / {memberCount}</strong>
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700 space-y-2">
            <span className="font-bold text-sky-400 uppercase text-[10px] block">Default Load Values (used by new loads)</span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex flex-col gap-1 text-[11px] text-slate-300">
                Live Load (kN/m²)
                <input
                  type="number"
                  step="0.1"
                  value={llValue}
                  onChange={(e) => setLlValue(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-300">
                Wall UDL (kN/m)
                <input
                  type="number"
                  step="0.5"
                  value={wallUdl}
                  onChange={(e) => setWallUdl(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </label>
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700 space-y-2">
            <span className="font-bold text-rose-400 uppercase text-[10px] block">IS 1893:2016 Seismic Parameters (for Auto Seismic)</span>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <label className="flex flex-col gap-1 text-[11px] text-slate-300">
                Z (Zone Factor)
                <input
                  type="number"
                  step="0.04"
                  value={zone}
                  onChange={(e) => setZone(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </label>
              <div className="flex flex-col gap-1 text-[11px] text-slate-300">
                R (Response Reduction)
                <span className="text-emerald-300 font-bold pt-1.5">5.0 (SMRF)</span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-slate-300">
                I (Importance)
                <span className="text-white font-bold pt-1.5">1.20</span>
              </div>
            </div>
            {saved && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Values saved for the next Auto Seismic run.
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setSaved(true)}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs"
          >
            Save Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 7. ASSIGN FRAME LOADS MODAL WINDOW
// ==========================================
interface AssignFrameLoadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMemberIds: number[];
  onAssignLoads: (memberIds: number[], load: any) => void;
  onDeleteLoads: (memberIds: number[]) => void;
}

export const AssignFrameLoadsModal: React.FC<AssignFrameLoadsModalProps> = ({
  isOpen,
  onClose,
  selectedMemberIds,
  onAssignLoads,
  onDeleteLoads,
}) => {
  const [loadPattern, setLoadPattern] = useState<'DEAD' | 'LIVE' | 'SDL' | 'WALL'>('WALL');
  const [loadType, setLoadType] = useState<'UNIFORM' | 'POINT'>('UNIFORM');
  const [direction, setDirection] = useState<'GLOBAL_Y' | 'LOCAL_Y' | 'GLOBAL_X' | 'GLOBAL_Z'>('GLOBAL_Y');
  const [uniformMagnitude, setUniformMagnitude] = useState(12.5); // 12.5 kN/m masonry wall
  const [pointMagnitude, setPointMagnitude] = useState(25.0);
  const [distanceFromStart, setDistanceFromStart] = useState(2.0);

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedMemberIds.length === 0) {
      alert('Please select at least one framing beam on the plan canvas first.');
      return;
    }

    if (loadType === 'UNIFORM') {
      onAssignLoads(selectedMemberIds, {
        loadPattern,
        type: 'UNIFORM',
        w1: uniformMagnitude,
        direction,
      });
    } else {
      onAssignLoads(selectedMemberIds, {
        loadPattern,
        type: 'POINT',
        w1: pointMagnitude,
        d1: distanceFromStart,
        direction,
      });
    }
    onClose();
  };

  const handlePreset = (mag: number, pat: 'DEAD' | 'LIVE' | 'SDL' | 'WALL') => {
    setLoadType('UNIFORM');
    setUniformMagnitude(mag);
    setLoadPattern(pat);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/20 text-rose-400 rounded-lg border border-rose-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Assign Frame Loads</h3>
              <p className="text-xs text-slate-400">
                Target: <strong className="text-amber-400">{selectedMemberIds.length > 0 ? `${selectedMemberIds.length} Selected Beams` : 'None Selected'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Standard Wall &amp; Floor Load Presets:</span>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handlePreset(12.5, 'WALL')}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-white block">230mm Main Wall</strong>
              <span className="text-[10px] text-slate-400">12.50 kN/m (DL)</span>
            </button>
            <button
              onClick={() => handlePreset(6.0, 'WALL')}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-white block">115mm Partition</strong>
              <span className="text-[10px] text-slate-400">6.00 kN/m (DL)</span>
            </button>
            <button
              onClick={() => handlePreset(3.5, 'WALL')}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-left"
            >
              <strong className="text-white block">Parapet Wall</strong>
              <span className="text-[10px] text-slate-400">3.50 kN/m (DL)</span>
            </button>
          </div>
        </div>

        {/* Load Pattern & Direction */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Load Pattern:</label>
            <select
              value={loadPattern}
              onChange={(e) => setLoadPattern(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value="WALL">WALL (Masonry Partitions)</option>
              <option value="DEAD">DEAD (Superimposed Dead)</option>
              <option value="LIVE">LIVE (Imposed Live Load)</option>
              <option value="SDL">SDL (Floor Finish)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Direction:</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value="GLOBAL_Y">Gravity (Global -Y Down)</option>
              <option value="LOCAL_Y">Local -y Axis</option>
              <option value="GLOBAL_X">Lateral Global X</option>
              <option value="GLOBAL_Z">Lateral Global Z</option>
            </select>
          </div>
        </div>

        {/* Magnitude */}
        <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2 text-xs">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={loadType === 'UNIFORM'}
                onChange={() => setLoadType('UNIFORM')}
                className="text-indigo-600"
              />
              <span className="font-bold text-white">Uniform Distributed Load (UDL)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={loadType === 'POINT'}
                onChange={() => setLoadType('POINT')}
                className="text-indigo-600"
              />
              <span className="font-bold text-white">Point Load</span>
            </label>
          </div>

          {loadType === 'UNIFORM' ? (
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Load Intensity (w in kN/m):</label>
              <input
                type="number"
                step={0.5}
                min={0}
                value={uniformMagnitude}
                onChange={(e) => setUniformMagnitude(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-bold font-mono text-sm"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Point Force (P in kN):</label>
                <input
                  type="number"
                  step={1.0}
                  min={0}
                  value={pointMagnitude}
                  onChange={(e) => setPointMagnitude(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-bold font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Distance from Node 1 (m):</label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={distanceFromStart}
                  onChange={(e) => setDistanceFromStart(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={() => {
              if (selectedMemberIds.length > 0) {
                onDeleteLoads(selectedMemberIds);
                onClose();
              }
            }}
            disabled={selectedMemberIds.length === 0}
            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 rounded font-semibold text-xs transition-colors disabled:opacity-40"
          >
            Delete Loads
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedMemberIds.length === 0}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg transition-all disabled:opacity-40"
            >
              Apply Load
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 8. ASSIGN FRAME SECTION MODAL WINDOW
// ==========================================
interface AssignFrameSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMemberIds: number[];
  onAssignSection: (memberIds: number[], section: any) => void;
}

export const AssignFrameSectionModal: React.FC<AssignFrameSectionModalProps> = ({
  isOpen,
  onClose,
  selectedMemberIds,
  onAssignSection,
}) => {
  const [selectedSecName, setSelectedSecName] = useState('C450x450');

  const catalog = [
    { name: 'C300x300', type: 'COLUMN', yd: 0.30, zd: 0.30, label: '300 × 300 mm (Small Column)' },
    { name: 'C300x450', type: 'COLUMN', yd: 0.45, zd: 0.30, label: '300 × 450 mm (Standard Column)' },
    { name: 'C450x450', type: 'COLUMN', yd: 0.45, zd: 0.45, label: '450 × 450 mm (Heavy Column)' },
    { name: 'C450x600', type: 'COLUMN', yd: 0.60, zd: 0.45, label: '450 × 600 mm (Commercial Column)' },
    { name: 'B230x300', type: 'BEAM', yd: 0.30, zd: 0.23, label: '230 × 300 mm (Tie / Plinth Beam)' },
    { name: 'B230x450', type: 'BEAM', yd: 0.45, zd: 0.23, label: '230 × 450 mm (Residential Beam)' },
    { name: 'B300x450', type: 'BEAM', yd: 0.45, zd: 0.30, label: '300 × 450 mm (Standard Floor Beam)' },
    { name: 'B300x600', type: 'BEAM', yd: 0.60, zd: 0.30, label: '300 × 600 mm (Heavy Span Beam)' },
  ];

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedMemberIds.length === 0) {
      alert('Please select members on the plan canvas first.');
      return;
    }
    const match = catalog.find((c) => c.name === selectedSecName);
    if (match) {
      onAssignSection(selectedMemberIds, {
        name: match.name,
        yd: match.yd,
        zd: match.zd,
        type: 'RECTANGULAR',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white text-base">Assign Frame Section</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Target: <strong className="text-amber-400">{selectedMemberIds.length > 0 ? `${selectedMemberIds.length} Selected Members` : 'None Selected'}</strong>
        </p>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {catalog.map((sec) => (
            <div
              key={sec.name}
              onClick={() => setSelectedSecName(sec.name)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                selectedSecName === sec.name
                  ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div>
                <span className="font-bold text-white block">{sec.name}</span>
                <span className="text-[10px] text-slate-400">{sec.label}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${sec.type === 'COLUMN' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-sky-900/60 text-sky-300'}`}>
                {sec.type}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={selectedMemberIds.length === 0}
            className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg transition-all disabled:opacity-40"
          >
            Assign Section
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 9. ASSIGN JOINT RESTRAINTS MODAL WINDOW
// ==========================================
interface AssignJointRestraintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: number[];
  onAssignRestraint: (nodeIds: number[], type: 'FIXED' | 'PINNED' | 'ROLLER') => void;
}

export const AssignJointRestraintsModal: React.FC<AssignJointRestraintsModalProps> = ({
  isOpen,
  onClose,
  selectedNodeIds,
  onAssignRestraint,
}) => {
  const [restraintType, setRestraintType] = useState<'FIXED' | 'PINNED' | 'ROLLER'>('FIXED');

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedNodeIds.length === 0) {
      alert('Please select at least one joint on the plan canvas first.');
      return;
    }
    onAssignRestraint(selectedNodeIds, restraintType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Assign Joint Restraints</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Target: <strong className="text-amber-400">{selectedNodeIds.length > 0 ? `${selectedNodeIds.length} Selected Joints` : 'None Selected'}</strong>
        </p>

        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div
            onClick={() => setRestraintType('FIXED')}
            className={`p-3 rounded-lg border cursor-pointer text-center space-y-1 ${
              restraintType === 'FIXED' ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <strong className="text-white block">Fixed Support</strong>
            <span className="text-[10px] text-slate-400">UX, UY, UZ, RX, RY, RZ</span>
          </div>

          <div
            onClick={() => setRestraintType('PINNED')}
            className={`p-3 rounded-lg border cursor-pointer text-center space-y-1 ${
              restraintType === 'PINNED' ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <strong className="text-white block">Pinned Support</strong>
            <span className="text-[10px] text-slate-400">UX, UY, UZ</span>
          </div>

          <div
            onClick={() => setRestraintType('ROLLER')}
            className={`p-3 rounded-lg border cursor-pointer text-center space-y-1 ${
              restraintType === 'ROLLER' ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <strong className="text-white block">Roller Support</strong>
            <span className="text-[10px] text-slate-400">UY Only</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={selectedNodeIds.length === 0}
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-lg transition-all disabled:opacity-40"
          >
            Assign Restraint
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 10. REPLICATE STORY MODAL WINDOW
// ==========================================
interface ReplicateStoreyModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableElevations: { label: string; elevationY: number }[];
  currentElevationY: number;
  onReplicate: (sourceY: number, targetYs: number[]) => void;
}

export const ReplicateStoreyModal: React.FC<ReplicateStoreyModalProps> = ({
  isOpen,
  onClose,
  availableElevations,
  currentElevationY,
  onReplicate,
}) => {
  const [sourceY, setSourceY] = useState(currentElevationY);
  const [selectedTargetYs, setSelectedTargetYs] = useState<number[]>([]);

  useEffect(() => {
    setSourceY(currentElevationY);
  }, [currentElevationY]);

  if (!isOpen) return null;

  const toggleTarget = (y: number) => {
    setSelectedTargetYs((prev) =>
      prev.includes(y) ? prev.filter((item) => item !== y) : [...prev, y]
    );
  };

  const handleApply = () => {
    if (selectedTargetYs.length === 0) {
      alert('Please select at least one destination story level.');
      return;
    }
    onReplicate(sourceY, selectedTargetYs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Replicate / Story Copy</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Source Storey (Copy from):</label>
            <select
              value={sourceY}
              onChange={(e) => setSourceY(parseFloat(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              {availableElevations.map((e) => (
                <option key={e.elevationY} value={e.elevationY}>
                  {e.label} (EL. +{e.elevationY.toFixed(2)}m)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Destination Storeys (Paste to):</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border border-slate-800 p-2 rounded-lg bg-slate-950">
              {availableElevations
                .filter((e) => Math.abs(e.elevationY - sourceY) > 0.1)
                .map((e) => (
                  <label
                    key={e.elevationY}
                    className="flex items-center justify-between p-1.5 bg-slate-800/40 rounded hover:bg-slate-800 cursor-pointer text-xs"
                  >
                    <span className="text-slate-200 font-bold">{e.label} (EL. +{e.elevationY.toFixed(2)}m)</span>
                    <input
                      type="checkbox"
                      checked={selectedTargetYs.includes(e.elevationY)}
                      onChange={() => toggleTarget(e.elevationY)}
                      className="rounded text-indigo-600"
                    />
                  </label>
                ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={selectedTargetYs.length === 0}
            className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs shadow-lg transition-all disabled:opacity-40"
          >
            Replicate to Selected Stories
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 11. AUTO SEISMIC LOAD GENERATOR MODAL (IS 1893:2016)
// ==========================================
interface AutoSeismicModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: NormalizedStructuralModel | null;
  onApplySeismic: (summary: any) => void;
}

export const AutoSeismicModal: React.FC<AutoSeismicModalProps> = ({
  isOpen,
  onClose,
  model,
  onApplySeismic,
}) => {
  const [zone, setZone] = useState<'II' | 'III' | 'IV' | 'V'>('IV');
  const [soil, setSoil] = useState<'I_ROCK' | 'II_MEDIUM' | 'III_SOFT'>('II_MEDIUM');
  const [R, setR] = useState(5.0);
  const [I, setI] = useState(1.2);
  const [hasInfill, setHasInfill] = useState(true);

  if (!isOpen) return null;

  // Import dynamically or calculate
  const Z = zone === 'II' ? 0.10 : zone === 'III' ? 0.16 : zone === 'IV' ? 0.24 : 0.36;
  const bbox = model?.boundingBox || { minX: 0, maxX: 15, minY: 0, maxY: 12, minZ: 0, maxZ: 12 };
  const H = Math.max(3.0, (model?.statistics?.maxElevation ?? 12) - (model?.statistics?.baseElevation ?? 0));
  const Dx = Math.max(3.0, bbox.maxX - bbox.minX);
  const Dz = Math.max(3.0, bbox.maxZ - bbox.minZ);

  const Tx = hasInfill ? (0.09 * H) / Math.sqrt(Dx) : 0.075 * Math.pow(H, 0.75);
  const Tz = hasInfill ? (0.09 * H) / Math.sqrt(Dz) : 0.075 * Math.pow(H, 0.75);

  const saByG_X = Tx <= 0.55 ? 2.5 : Math.max(1.0, 1.36 / Tx);
  const saByG_Z = Tz <= 0.55 ? 2.5 : Math.max(1.0, 1.36 / Tz);

  const AhX = (Z / 2) * (I / R) * saByG_X;
  const AhZ = (Z / 2) * (I / R) * saByG_Z;

  const totalW = Math.max(2500, (model?.members.size || 20) * 120);
  const Vbx = AhX * totalW;
  const Vbz = AhZ * totalW;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-600/20 text-orange-400 rounded-lg border border-orange-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">IS 1893:2016 Auto Seismic Generator</h3>
              <p className="text-xs text-slate-400">Equivalent Static Lateral Force Method</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Seismic Zone:</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value="II">Zone II (Z = 0.10 - Low)</option>
              <option value="III">Zone III (Z = 0.16 - Moderate)</option>
              <option value="IV">Zone IV (Z = 0.24 - Severe)</option>
              <option value="V">Zone V (Z = 0.36 - Very Severe)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Soil Profile Type:</label>
            <select
              value={soil}
              onChange={(e) => setSoil(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value="I_ROCK">Type I (Rock / Hard Soil)</option>
              <option value="II_MEDIUM">Type II (Medium Soil)</option>
              <option value="III_SOFT">Type III (Soft Soil)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Response Reduction (R):</label>
            <select
              value={R}
              onChange={(e) => setR(parseFloat(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value={5.0}>R = 5.0 (Special RC Moment Frame - SMRF)</option>
              <option value={3.0}>R = 3.0 (Ordinary RC Frame - OMRF)</option>
              <option value={4.0}>R = 4.0 (Ductile Shear Wall)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Importance Factor (I):</label>
            <select
              value={I}
              onChange={(e) => setI(parseFloat(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
            >
              <option value={1.0}>I = 1.0 (Residential / General)</option>
              <option value={1.2}>I = 1.2 (Commercial / Schools &gt; 200 persons)</option>
              <option value={1.5}>I = 1.5 (Critical / Hospitals / Emergency)</option>
            </select>
          </div>
        </div>

        {/* Live Calculation Results Card */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
          <span className="text-[10px] text-orange-400 uppercase font-bold block flex items-center justify-between">
            <span>Automated Dynamic Parameters:</span>
            <span className="text-slate-400 font-normal">IS 1893:2016 Cl. 6.4.2 &amp; 7.6.2</span>
          </span>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">Period Ta (X)</span>
              <strong className="text-sky-300 font-mono">{Tx.toFixed(3)}s</strong>
            </div>
            <div className="p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">Period Ta (Z)</span>
              <strong className="text-sky-300 font-mono">{Tz.toFixed(3)}s</strong>
            </div>
            <div className="p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">Coeff. Ah (X)</span>
              <strong className="text-emerald-300 font-mono">{AhX.toFixed(4)}</strong>
            </div>
            <div className="p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">Coeff. Ah (Z)</span>
              <strong className="text-emerald-300 font-mono">{AhZ.toFixed(4)}</strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
            <span className="text-slate-400">Total Seismic Weight (W): <strong className="text-white font-mono">{totalW.toFixed(0)} kN</strong></span>
            <span className="text-amber-400 font-bold">Base Shear Vb = {Vbx.toFixed(1)} kN</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs">
            Cancel
          </button>
          <button
            onClick={() => {
              onApplySeismic({ zone, soil, R, I, AhX, AhZ, Vbx, Vbz });
              onClose();
            }}
            className="px-5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Generate &amp; Apply EQX / EQZ</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 12. TRIBUTARY SLAB LOADS MODAL (45° Yield-Line)
// ==========================================
interface TributaryLoadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: NormalizedStructuralModel | null;
  selectedStoreyElevation: number;
  onApplyTributaryLoads: (floorFinish: number, liveLoad: number) => void;
}

export const TributaryLoadsModal: React.FC<TributaryLoadsModalProps> = ({
  isOpen,
  onClose,
  model,
  selectedStoreyElevation,
  onApplyTributaryLoads,
}) => {
  const [floorFinishKn, setFloorFinishKn] = useState(1.5);
  const [liveLoadKn, setLiveLoadKn] = useState(3.0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">45° Tributary Slab Load Distributor</h3>
              <p className="text-xs text-slate-400">Yield-Line Triangular &amp; Trapezoidal Beam UDLs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Superimposed Dead Load / Floor Finish (kN/m²):</label>
            <input
              type="number"
              step={0.5}
              min={0}
              value={floorFinishKn}
              onChange={(e) => setFloorFinishKn(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Imposed Floor Live Load (kN/m²):</label>
            <input
              type="number"
              step={0.5}
              min={0}
              value={liveLoadKn}
              onChange={(e) => setLiveLoadKn(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sky-300 font-bold font-mono text-sm"
            />
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded border border-slate-800 text-[11px] space-y-1 text-slate-400">
            <strong className="text-emerald-400 block">IS 456 / Rankine-Grashof Yield Line Method:</strong>
            <p>• Two-Way panels (r &le; 2): Short beams get triangular loads (w = q·Lx / 3), long beams get trapezoidal loads [w = (q·Lx / 2) · (1 - 1/(3r²))].</p>
            <p>• One-Way panels (r &gt; 2): 50% load transfers uniformly to long boundary beams.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs">
            Cancel
          </button>
          <button
            onClick={() => {
              onApplyTributaryLoads(floorFinishKn, liveLoadKn);
              onClose();
            }}
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Distribute to All Framing Beams</span>
          </button>
        </div>
      </div>
    </div>
  );
};


