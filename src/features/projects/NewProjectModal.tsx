import React, { useState } from 'react';
import { useProjectStore } from './projectStore';
import {
  FolderPlus,
  Sparkles,
  Building,
  Box,
  Layers,
  Sliders,
  ShieldCheck,
  Upload,
  X,
  CheckCircle2,
  TrendingUp,
  MapPin,
  User,
  Tag,
  FileCode,
} from 'lucide-react';
import { ConcreteGrade, SteelGrade, DesignParameters } from '@/types';

export const NewProjectModal: React.FC = () => {
  const {
    isNewProjectModalOpen,
    setNewProjectModalOpen,
    createProject,
    generateBuildingGrid,
    setActiveView,
    setImportModalOpen,
  } = useProjectStore();

  // Project details
  const [name, setName] = useState('G+3 RCC Residential Building');
  const [code, setCode] = useState(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [client, setClient] = useState('Prestige Constructions');
  const [engineer, setEngineer] = useState('Er. Structural Consultant');
  const [location, setLocation] = useState('Metropolitan City');

  // Materials & Design Settings
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>('M25');
  const [steelGrade, setSteelGrade] = useState<SteelGrade>('Fe500D');
  const [seismicZone, setSeismicZone] = useState<'II' | 'III' | 'IV' | 'V'>('IV');
  const [importanceFactor, setImportanceFactor] = useState<number>(1.2);
  const [soilType, setSoilType] = useState<'I_ROCK' | 'II_MEDIUM' | 'III_SOFT'>('II_MEDIUM');

  // Starting Template / Mode
  const [startMode, setStartMode] = useState<'WIZARD' | 'BLANK' | 'ANL'>('WIZARD');

  // Parametric Grid Inputs (if WIZARD selected)
  const [baysX, setBaysX] = useState(3);
  const [baysZ, setBaysZ] = useState(2);
  const [widthX, setWidthX] = useState(4.5);
  const [widthZ, setWidthZ] = useState(4.0);
  const [stories, setStories] = useState(4);
  const [storyH, setStoryH] = useState(3.2);

  if (!isNewProjectModalOpen) return null;

  const handleCreate = async () => {
    const designSettings: DesignParameters = {
      code: 'IS456_2000',
      concreteGrade,
      steelGrade,
      shearRebarGrade: steelGrade,
      clearCoverBeam: 30,
      clearCoverColumn: 40,
      clearCoverFooting: 50,
      clearCoverSlab: 20,
      clearCoverPile: 60,
      maxAggregateSize: 20,
      seismicZone,
      responseReductionFactor: 5,
      importanceFactor,
      soilType,
      windSpeed: 39,
      windTerrainCategory: 2,
    };

    if (startMode === 'ANL') {
      setNewProjectModalOpen(false);
      setImportModalOpen(true);
      return;
    }

    if (startMode === 'WIZARD') {
      // 1. Create project with metadata
      await createProject({
        name,
        code,
        client,
        engineer,
        location,
        description: `${baysX}x${baysZ} Bay G+${stories - 1} RCC Structure designed to IS 456 / IS 13920`,
        designSettings,
      });

      // 2. Generate parametric building frame & solve FEM
      await generateBuildingGrid(baysX, baysZ, widthX, widthZ, stories, storyH);
      setActiveView('etabs-studio');
      setNewProjectModalOpen(false);
    } else {
      // BLANK Model
      await createProject({
        name,
        code,
        client,
        engineer,
        location,
        description: 'Custom Drafted RCC Structural Model',
        designSettings,
      });
      setActiveView('etabs-studio');
      setNewProjectModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Create New Structural Project</h3>
              <p className="text-xs text-slate-400">Configure project details, design codes, concrete grades &amp; frame setup</p>
            </div>
          </div>
          <button onClick={() => setNewProjectModalOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Project Information Fields */}
        <div className="space-y-3">
          <span className="text-[11px] text-sky-400 uppercase font-bold flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>1. Project Information</span>
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-slate-400 block mb-1">Project Name:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-bold"
                placeholder="e.g. G+4 Commercial Tower"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-slate-400 block mb-1">Project Code:</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Client Name:</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Lead Structural Engineer:</label>
              <input
                type="text"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* 2. Materials & Design Parameters */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <span className="text-[11px] text-amber-400 uppercase font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Materials &amp; Design Code (IS 456 / IS 13920 / IS 1893)</span>
          </span>

          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Concrete Grade */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block">Concrete Grade (fck):</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['M20', 'M25', 'M30', 'M35', 'M40'] as ConcreteGrade[]).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setConcreteGrade(grade)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                      concreteGrade === grade
                        ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Steel Grade */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block">Steel Rebar Grade (fy):</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['Fe415', 'Fe500', 'Fe500D', 'Fe550'] as SteelGrade[]).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSteelGrade(grade)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                      steelGrade === grade
                        ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Seismic Zone */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block">IS 1893 Seismic Zone:</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['II', 'III', 'IV', 'V'] as const).map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setSeismicZone(zone)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                      seismicZone === zone
                        ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Zone {zone}
                  </button>
                ))}
              </div>
            </div>

            {/* Importance Factor & Soil */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block">Soil Profile:</label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as any)}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-xs cursor-pointer"
              >
                <option value="I_ROCK">Type I (Hard Rock)</option>
                <option value="II_MEDIUM">Type II (Medium Soil)</option>
                <option value="III_SOFT">Type III (Soft Clay)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Starting Template / Mode */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <span className="text-[11px] text-emerald-400 uppercase font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>3. Choose Starting Template</span>
          </span>

          <div className="grid grid-cols-3 gap-3 text-xs">
            {/* Mode 1: Parametric Wizard */}
            <div
              onClick={() => setStartMode('WIZARD')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                startMode === 'WIZARD'
                  ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className={`w-4 h-4 ${startMode === 'WIZARD' ? 'text-amber-400' : 'text-slate-400'}`} />
                <strong className={startMode === 'WIZARD' ? 'text-white' : 'text-slate-300'}>Auto Frame Wizard</strong>
              </div>
              <p className="text-[10px] text-slate-400">Generate parametric multi-storey building with 1-click FEM solve.</p>
            </div>

            {/* Mode 2: Blank Canvas */}
            <div
              onClick={() => setStartMode('BLANK')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                startMode === 'BLANK'
                  ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Box className={`w-4 h-4 ${startMode === 'BLANK' ? 'text-sky-400' : 'text-slate-400'}`} />
                <strong className={startMode === 'BLANK' ? 'text-white' : 'text-slate-300'}>Blank Canvas</strong>
              </div>
              <p className="text-[10px] text-slate-400">Start empty &amp; manually draft columns, beams, slabs in 2D/3D.</p>
            </div>

            {/* Mode 3: Import ANL */}
            <div
              onClick={() => setStartMode('ANL')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                startMode === 'ANL'
                  ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Upload className={`w-4 h-4 ${startMode === 'ANL' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <strong className={startMode === 'ANL' ? 'text-white' : 'text-slate-300'}>Import STAAD</strong>
              </div>
              <p className="text-[10px] text-slate-400">Upload existing STAAD.Pro analysis (.anl) output file.</p>
            </div>
          </div>

          {/* If Wizard Mode: Quick Parameter Grid */}
          {startMode === 'WIZARD' && (
            <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg space-y-2 text-xs">
              <span className="text-[10px] text-indigo-300 font-bold uppercase block">Frame Dimensions:</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">X-Bays &amp; Width:</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={baysX}
                      onChange={(e) => setBaysX(parseInt(e.target.value, 10) || 3)}
                      className="w-12 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                    <input
                      type="number"
                      step={0.5}
                      min={2.5}
                      value={widthX}
                      onChange={(e) => setWidthX(parseFloat(e.target.value) || 4.5)}
                      className="flex-1 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Z-Bays &amp; Width:</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={baysZ}
                      onChange={(e) => setBaysZ(parseInt(e.target.value, 10) || 2)}
                      className="w-12 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                    <input
                      type="number"
                      step={0.5}
                      min={2.5}
                      value={widthZ}
                      onChange={(e) => setWidthZ(parseFloat(e.target.value) || 4.0)}
                      className="flex-1 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Storeys &amp; Height:</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={stories}
                      onChange={(e) => setStories(parseInt(e.target.value, 10) || 4)}
                      className="w-12 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                    <input
                      type="number"
                      step={0.1}
                      min={2.5}
                      value={storyH}
                      onChange={(e) => setStoryH(parseFloat(e.target.value) || 3.2)}
                      className="flex-1 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setNewProjectModalOpen(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg transition-all flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create &amp; Launch Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
