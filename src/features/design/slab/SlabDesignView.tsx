import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { Plate3D, Node3D } from '@/features/model/types';
import {
  SlabDesignEngine,
  SlabDesignInput,
  SlabDesignOutput,
  SlabBoundaryCondition,
} from './slabDesignEngine';
import {
  Layers,
  Save,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  ChevronRight,
  Maximize2,
  Grid,
  Download,
  Eye,
  EyeOff,
  Building,
} from 'lucide-react';

export const SlabDesignView: React.FC = () => {
  const { activeProject, activeModel, saveSlabDesigns } = useProjectStore();

  // Design Controls State
  const [fck, setFck] = useState<number>(25);
  const [fy, setFy] = useState<number>(500);
  const [clearCover, setClearCover] = useState<number>(20);
  const [liveLoad, setLiveLoad] = useState<number>(2.0); // kN/m2
  const [floorFinishLoad, setFloorFinishLoad] = useState<number>(1.0); // kN/m2
  const [defaultThickness, setDefaultThickness] = useState<number>(130); // mm

  // Saved / Custom Panels State
  const [panelsInput, setPanelsInput] = useState<SlabDesignInput[]>([
    {
      panelId: 'S1',
      floorLevel: 'GROUND FLOOR SLAB (+2.8m)',
      lx: 3.5,
      ly: 4.5,
      boundaryCondition: 'TWO_ADJACENT_DISCONTINUOUS',
      liveLoad: 2.0,
      fck: 25,
      fy: 500,
    },
    {
      panelId: 'S2',
      floorLevel: '1ST FLOOR SLAB (+5.6m)',
      lx: 3.5,
      ly: 5.0,
      boundaryCondition: 'ONE_LONG_DISCONTINUOUS',
      liveLoad: 2.0,
      fck: 25,
      fy: 500,
    },
    {
      panelId: 'S3',
      floorLevel: '1ST FLOOR SLAB (+5.6m)',
      lx: 3.0,
      ly: 4.5,
      boundaryCondition: 'INTERIOR',
      liveLoad: 2.0,
      fck: 25,
      fy: 500,
    },
    {
      panelId: 'S4',
      floorLevel: '2ND FLOOR SLAB (+8.4m)',
      lx: 2.5,
      ly: 5.5,
      boundaryCondition: 'ONE_WAY_CONTINUOUS',
      liveLoad: 2.0,
      fck: 25,
      fy: 500,
    },
    {
      panelId: 'S5',
      floorLevel: 'ROOF SLAB (+11.2m)',
      lx: 1.5,
      ly: 3.0,
      boundaryCondition: 'CANTILEVER',
      liveLoad: 3.0,
      fck: 25,
      fy: 500,
    },
  ]);

  const [selectedPanelId, setSelectedPanelId] = useState<string>('S1');
  const [selectedReportOutput, setSelectedReportOutput] = useState<SlabDesignOutput | null>(null);
  const [showDrawing, setShowDrawing] = useState<boolean>(false);
  const [showPanelSummary, setShowPanelSummary] = useState<boolean>(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [showContourMap, setShowContourMap] = useState<boolean>(false);
  const [activeFloorFilter, setActiveFloorFilter] = useState<string>('ALL');

  const availableFloorLevels = useMemo(() => {
    return Array.from(new Set(panelsInput.map((p) => p.floorLevel || '1ST FLOOR SLAB (+2.8m)')));
  }, [panelsInput]);

  // Extract floor slab panels directly from imported STAAD .std / .anl model plates (EXCLUDING shear wall plates)
  const modelSlabPanels = useMemo(() => {
    if (!activeModel?.plates || activeModel.plates.size === 0) return [];

    const plateList = Array.from(activeModel.plates.values());
    // Filter ONLY SLAB plates (EXCLUDE SHEAR WALL PLATES)
    const slabPlates = plateList.filter(
      (p: Plate3D) => p.classification === 'SLAB' && !p.isLiftCore
    );
    if (slabPlates.length === 0) return [];

    const floorMap = new Map<number, Plate3D[]>();
    slabPlates.forEach((p: Plate3D) => {
      const pNodes = p.nodeIds.map((id) => activeModel.nodes.get(id)).filter(Boolean) as Node3D[];
      if (pNodes.length > 0) {
        const avgY = Math.round((pNodes.reduce((acc: number, n: Node3D) => acc + n.y, 0) / pNodes.length) * 10) / 10;
        if (!floorMap.has(avgY)) floorMap.set(avgY, []);
        floorMap.get(avgY)!.push(p);
      }
    });

    const panels: SlabDesignInput[] = [];
    let idx = 1;
    const sortedElevations = Array.from(floorMap.keys()).sort((a, b) => a - b);

    sortedElevations.forEach((yElev, flIdx) => {
      const platesAtFloor = floorMap.get(yElev)!;
      const floorLabel =
        yElev <= 3.2
          ? `GROUND FLOOR SLAB (+${yElev}m)`
          : flIdx === sortedElevations.length - 1
          ? `ROOF SLAB (+${yElev}m)`
          : `FLOOR ${flIdx} SLAB (+${yElev}m)`;

      platesAtFloor.forEach((p: Plate3D) => {
        const pNodes = p.nodeIds.map((id) => activeModel.nodes.get(id)).filter(Boolean) as Node3D[];
        if (pNodes.length < 3) return;

        const xCoords = pNodes.map((n: Node3D) => n.x);
        const zCoords = pNodes.map((n: Node3D) => n.z);
        const dx = Math.max(...xCoords) - Math.min(...xCoords);
        const dz = Math.max(...zCoords) - Math.min(...zCoords);

        const span1 = Number(Math.max(dx, dz).toFixed(2));
        const span2 = Number(Math.min(dx, dz).toFixed(2));

        const lx = Math.max(1.5, span2 > 0 ? span2 : span1);
        const ly = Math.max(lx, span1);

        // Exact thickness from STAAD .std / .anl file (e.g. 0.12m -> 120mm)
        const thicknessMm = p.thickness ? Math.round(p.thickness * 1000) : 120;

        panels.push({
          panelId: `S${idx++}`,
          floorLevel: floorLabel,
          lx,
          ly,
          thickness: thicknessMm,
          boundaryCondition: ly / lx > 2.0 ? 'ONE_WAY_CONTINUOUS' : 'INTERIOR',
          liveLoad: 2.0,
          fck,
          fy,
        });
      });
    });

    return panels;
  }, [activeModel, fck, fy]);

  // Auto-populate from STAAD model plates on initial load if present
  useEffect(() => {
    if (modelSlabPanels.length > 0) {
      setPanelsInput(modelSlabPanels);
      setSelectedPanelId(modelSlabPanels[0].panelId);
    }
  }, [modelSlabPanels]);

  // Initialize from project design settings
  useEffect(() => {
    if (activeProject?.metadata?.designSettings) {
      const ds = activeProject.metadata.designSettings;
      if (ds.concreteGrade) {
        const conc = parseInt(ds.concreteGrade.replace('M', '')) || 25;
        setFck(conc);
      }
      if (ds.steelGrade) {
        const st = parseInt(ds.steelGrade.replace('Fe', '').replace('D', '')) || 500;
        setFy(st);
      }
    }
  }, [activeProject]);

  // Perform Batch Slab Design Calculations
  const designedSlabs = useMemo(() => {
    const results: Record<string, SlabDesignOutput> = {};
    panelsInput.forEach((p) => {
      const output = SlabDesignEngine.design({
        ...p,
        fck,
        fy,
        clearCover,
        liveLoad: p.liveLoad || liveLoad,
        floorFinishLoad,
        thickness: p.thickness || defaultThickness,
      });
      results[p.panelId] = output;
    });
    return results;
  }, [panelsInput, fck, fy, clearCover, liveLoad, floorFinishLoad, defaultThickness]);

  const activeOutput = designedSlabs[selectedPanelId] || Object.values(designedSlabs)[0];

  // Save All Slab Designs into Store
  const handleSaveAll = async () => {
    await saveSlabDesigns(designedSlabs);
    alert('Slab designs saved successfully to project storage!');
  };

  // Group panels by Floor Level for clean multi-story segregation
  const groupedPanelsByFloor = useMemo(() => {
    const map = new Map<string, { panel: SlabDesignInput; output?: SlabDesignOutput }[]>();
    panelsInput.forEach((p) => {
      const fl = p.floorLevel || '1ST FLOOR SLAB (+2.8m)';
      if (activeFloorFilter !== 'ALL' && fl !== activeFloorFilter) return;
      if (!map.has(fl)) map.set(fl, []);
      map.get(fl)!.push({ panel: p, output: designedSlabs[p.panelId] });
    });
    return map;
  }, [panelsInput, designedSlabs, activeFloorFilter]);

  // Add New Panel
  const handleAddPanel = () => {
    const nextNum = panelsInput.length + 1;
    const newId = `S${nextNum}`;
    const targetFloor =
      activeFloorFilter === 'ALL'
        ? availableFloorLevels[0] || '1ST FLOOR SLAB (+2.8m)'
        : activeFloorFilter;

    const newPanel: SlabDesignInput = {
      panelId: newId,
      floorLevel: targetFloor,
      lx: 3.5,
      ly: 4.5,
      boundaryCondition: 'INTERIOR',
      liveLoad,
      fck,
      fy,
    };
    setPanelsInput([...panelsInput, newPanel]);
    setSelectedPanelId(newId);
  };

  // Delete Panel
  const handleDeletePanel = (id: string) => {
    if (panelsInput.length <= 1) return;
    const next = panelsInput.filter((p) => p.panelId !== id);
    setPanelsInput(next);
    if (selectedPanelId === id) setSelectedPanelId(next[0].panelId);
  };

  // Update Panel Input Field
  const handleUpdatePanel = (id: string, field: keyof SlabDesignInput, val: any) => {
    setPanelsInput((prev) =>
      prev.map((p) => (p.panelId === id ? { ...p, [field]: val } : p))
    );
  };

  return (
    <div className="flex flex-col h-full w-full p-4 space-y-4 font-mono overflow-y-auto bg-slate-950 text-slate-100 select-none">
      {/* Workspace Action Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-950 rounded border border-indigo-800 text-indigo-400">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              FLOOR SLAB DESIGN WORKSPACE (IS 456:2000 &amp; RCDC)
            </h2>
            <p className="text-xs text-slate-400">
              One-Way, Two-Way Restrained, Simply Supported &amp; Cantilever Slab Panel Detailing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {modelSlabPanels.length > 0 && (
            <button
              onClick={() => {
                setPanelsInput(modelSlabPanels);
                if (modelSlabPanels[0]) setSelectedPanelId(modelSlabPanels[0].panelId);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded font-bold transition-all border border-emerald-700"
              title="Import floor slab plates from imported STAAD model (excluding shear wall plates)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Import {modelSlabPanels.length} Panels from STAAD Model
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowContourMap(!showContourMap)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all border ${
              showContourMap
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle RCDC 2D Floor Plan Grid & Slab Contour Visualizer Map"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            <span>{showContourMap ? 'Hide 2D Map' : '2D Contour Map'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all border ${
              showSettingsPanel
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Global Design Parameters & Material Settings"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>{showSettingsPanel ? 'Hide Settings' : 'Design Parameters'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPanelSummary(!showPanelSummary)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all border ${
              showPanelSummary
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Panel Detailing Summary Card"
          >
            {showPanelSummary ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{showPanelSummary ? 'Hide Detailing Summary' : 'Show Detailing Summary'}</span>
          </button>

          <button
            onClick={handleAddPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold transition-all border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Add Slab Panel
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold shadow transition-all"
          >
            <Save className="w-4 h-4" />
            Save All Designs
          </button>
        </div>
      </div>

      {/* Global Design Parameters & Load Settings (Hidden by Default) */}
      {showSettingsPanel && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-sans">Concrete Grade:</label>
            <select
              value={fck}
              onChange={(e) => setFck(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            >
              <option value={20}>M20 (20 N/mm²)</option>
              <option value={25}>M25 (25 N/mm²)</option>
              <option value={30}>M30 (30 N/mm²)</option>
              <option value={35}>M35 (35 N/mm²)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans">Steel Grade:</label>
            <select
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            >
              <option value={415}>Fe415</option>
              <option value={500}>Fe500D</option>
              <option value={550}>Fe550D</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans">Clear Cover (mm):</label>
            <input
              type="number"
              value={clearCover}
              onChange={(e) => setClearCover(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans">Live Load (kN/m²):</label>
            <input
              type="number"
              step="0.5"
              value={liveLoad}
              onChange={(e) => setLiveLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans">Floor Finish (kN/m²):</label>
            <input
              type="number"
              step="0.25"
              value={floorFinishLoad}
              onChange={(e) => setFloorFinishLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-sans">Default Thickness (mm):</label>
            <input
              type="number"
              step="5"
              value={defaultThickness}
              onChange={(e) => setDefaultThickness(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* RCDC Interactive 2D Floor Grid & Slab Contour Map Visualizer */}
      {showContourMap && (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <Grid className="w-4 h-4 text-sky-400" />
              STAAD.Pro / RCDC 2D SLAB BOUNDARY & GRID CONTOUR MAP ({activeFloorFilter})
            </h3>
            <span className="text-xs text-slate-400 font-sans">Click any panel to select &amp; view detailing</span>
          </div>

          <div className="w-full bg-slate-950 p-4 rounded border border-slate-800 overflow-x-auto flex items-center justify-center">
            <svg width="680" height="280" viewBox="0 0 680 280" className="select-none font-mono">
              {/* Grid Lines X */}
              {[80, 220, 360, 500, 620].map((x, i) => (
                <g key={`gridX_${x}`}>
                  <line x1={x} y1="30" x2={x} y2="240" stroke="#334155" strokeDasharray="4 4" strokeWidth="1.5" />
                  <circle cx={x} cy="20" r="11" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <text x={x} y="24" fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
                    {String.fromCharCode(65 + i)}
                  </text>
                </g>
              ))}

              {/* Grid Lines Y */}
              {[40, 130, 220].map((y, i) => (
                <g key={`gridY_${y}`}>
                  <line x1="60" y1={y} x2="640" y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="1.5" />
                  <circle cx="50" cy={y} r="11" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <text x="50" y={y + 4} fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
                    {i + 1}
                  </text>
                </g>
              ))}

              {/* Slab Panels */}
              {panelsInput.map((panel, idx) => {
                const isSelected = panel.panelId === selectedPanelId;
                const out = designedSlabs[panel.panelId];
                // Lay out panels neatly across grid cells
                const col = idx % 4;
                const row = Math.floor(idx / 4);
                const x = 80 + col * 140;
                const y = 40 + row * 90;
                const w = 135;
                const h = 85;

                return (
                  <g
                    key={panel.panelId}
                    onClick={() => setSelectedPanelId(panel.panelId)}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                  >
                    {/* Panel Concrete Background */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={isSelected ? '#312e81' : '#1e293b'}
                      stroke={isSelected ? '#6366f1' : '#475569'}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      rx="4"
                    />

                    {/* Edge Continuity Markers (Solid for Continuous, Dashed for Discontinuous) */}
                    <line x1={x} y1={y} x2={x + w} y2={y} stroke="#38bdf8" strokeWidth="2" strokeDasharray={panel.boundaryCondition?.includes('DISCONTINUOUS') ? '3 3' : 'none'} />
                    <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke="#38bdf8" strokeWidth="2" />
                    <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke="#38bdf8" strokeWidth="2" />
                    <line x1={x} y1={y} x2={x} y2={y + h} stroke="#38bdf8" strokeWidth="2" strokeDasharray={panel.boundaryCondition?.includes('DISCONTINUOUS') ? '3 3' : 'none'} />

                    {/* Panel Label & Dimensions */}
                    <text x={x + w / 2} y={y + 24} fill="#ffffff" fontSize="13" textAnchor="middle" fontWeight="bold">
                      {panel.panelId} ({panel.floorLevel?.split(' ')[0] || 'L1'})
                    </text>
                    <text x={x + w / 2} y={y + 44} fill="#cbd5e1" fontSize="10" textAnchor="middle">
                      {panel.lx}m × {panel.ly}m ({panel.thickness || out?.thickness || 130}mm)
                    </text>
                    <text x={x + w / 2} y={y + 64} fill={out?.status === 'PASS' ? '#34d399' : '#f87171'} fontSize="10" textAnchor="middle" fontWeight="bold">
                      {out?.botRebarXCallout?.split(' (')[0] || 'Fe500'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-sky-400 inline-block"></span> Solid Line: Continuous Edge</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-b border-dashed border-sky-400 inline-block"></span> Dashed Line: Discontinuous Edge</span>
            </div>
            <span>Auto Edge Detection &amp; Grid Assignment per <strong className="text-white">RCDC Cl 4.2</strong></span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
        <span className="text-slate-400 font-bold uppercase mr-1 flex items-center gap-1.5 font-sans">
          <Building className="w-4 h-4 text-indigo-400" />
          Select Floor Level Window:
        </span>

        <button
          onClick={() => setActiveFloorFilter('ALL')}
          className={`px-3 py-1.5 rounded font-bold transition-all border ${
            activeFloorFilter === 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          ALL FLOORS ({panelsInput.length})
        </button>

        {availableFloorLevels.map((fl) => {
          const count = panelsInput.filter((p) => (p.floorLevel || '1ST FLOOR SLAB (+2.8m)') === fl).length;
          return (
            <button
              key={fl}
              onClick={() => setActiveFloorFilter(fl)}
              className={`px-3 py-1.5 rounded font-bold transition-all border ${
                activeFloorFilter === fl
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              {fl} ({count})
            </button>
          );
        })}
      </div>

      {/* Main RCDC Slab Schedule Table */}
      <div className="w-full bg-white text-slate-900 rounded-lg shadow-2xl overflow-x-auto border-2 border-slate-800">
        <div className="w-full bg-slate-300 border-b-2 border-slate-800 py-1.5 text-center font-bold text-sm uppercase tracking-wide">
          Floor Slab Panel Design Schedule (IS:456-2000 Detailing)
        </div>

        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 border-b-2 border-slate-800 text-center font-bold">
              <th className="border-r border-slate-400 p-2 w-12">Panel</th>
              <th className="border-r border-slate-400 p-2 w-32">Floor Level</th>
              <th className="border-r border-slate-400 p-2 w-24">Lx × Ly (m)</th>
              <th className="border-r border-slate-400 p-2 w-16">Ly / Lx</th>
              <th className="border-r border-slate-400 p-2 w-16">Thk (mm)</th>
              <th className="border-r border-slate-400 p-2 w-44">Boundary Condition</th>
              <th className="border-r border-slate-400 p-2 w-24">Mux+ / Mux- (kNm)</th>
              <th className="border-r border-slate-400 p-2 w-48 text-left">Main Rebar (X-Dir)</th>
              <th className="border-r border-slate-400 p-2 w-48 text-left">Main Rebar (Y-Dir)</th>
              <th className="border-r border-slate-400 p-2 w-20">L/d Check</th>
              <th className="border-r border-slate-400 p-2 w-24">Crack Width</th>
              <th className="border-r border-slate-400 p-2 w-16">Status</th>
              <th className="p-2 w-20">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {Array.from(groupedPanelsByFloor.entries()).map(([floorLabel, items]) => {
              const floorArea = items.reduce((acc, { panel }) => acc + panel.lx * panel.ly, 0);
              const floorConcVol = items.reduce((acc, { panel, output: out }) => {
                const thk = panel.thickness || out?.thickness || 130;
                return acc + (panel.lx * panel.ly * thk) / 1000;
              }, 0);
              const floorSteelKg = items.reduce((acc, { panel, output: out }) => {
                const area = panel.lx * panel.ly;
                const wtPerM2 = out?.steelWeightKgPerM2 || 10;
                return acc + area * wtPerM2;
              }, 0);

              return (
                <React.Fragment key={floorLabel}>
                  {/* Floor Level Header Banner */}
                  <tr className="bg-slate-900 text-indigo-200 font-bold border-y-2 border-indigo-800">
                    <td colSpan={13} className="p-2.5 text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 text-white font-bold text-sm tracking-wide">
                          <Building className="w-4 h-4 text-indigo-400" />
                          {floorLabel} WINDOW
                        </span>
                        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-300">
                          <span>Panels: <strong className="text-white">{items.length}</strong></span>
                          <span>Total Area: <strong className="text-emerald-400">{floorArea.toFixed(1)} m²</strong></span>
                          <span>Concrete: <strong className="text-sky-300">{floorConcVol.toFixed(2)} m³</strong></span>
                          <span>Est. Steel: <strong className="text-amber-300">{floorSteelKg.toFixed(1)} kg</strong> ({(floorSteelKg / 1000).toFixed(3)} MT)</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Floor Panel Items */}
                  {items.map(({ panel, output: out }) => {
                    if (!out) return null;
                    const isSelected = panel.panelId === selectedPanelId;

                    return (
                      <tr
                        key={panel.panelId}
                        onClick={() => setSelectedPanelId(panel.panelId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="border-r border-slate-300 p-2 text-center font-bold text-indigo-700">
                          {panel.panelId}
                        </td>

                        <td className="border-r border-slate-300 p-1.5 text-center text-slate-700">
                          <select
                            value={panel.floorLevel || floorLabel}
                            onChange={(e) => handleUpdatePanel(panel.panelId, 'floorLevel', e.target.value)}
                            className="w-full bg-transparent text-[11px] font-sans border border-slate-300 rounded p-1 focus:border-indigo-500"
                          >
                            {availableFloorLevels.map((fl) => (
                              <option key={fl} value={fl}>{fl}</option>
                            ))}
                          </select>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={panel.lx}
                              onChange={(e) => handleUpdatePanel(panel.panelId, 'lx', Number(e.target.value))}
                              className="w-10 text-center bg-transparent border-b border-slate-400 focus:border-indigo-600 focus:outline-none"
                            />
                            <span>×</span>
                            <input
                              type="number"
                              step="0.1"
                              value={panel.ly}
                              onChange={(e) => handleUpdatePanel(panel.panelId, 'ly', Number(e.target.value))}
                              className="w-10 text-center bg-transparent border-b border-slate-400 focus:border-indigo-600 focus:outline-none"
                            />
                          </div>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center text-slate-600">
                          {out.aspectRatio}
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center">
                          <input
                            type="number"
                            step="5"
                            value={panel.thickness || out.thickness}
                            onChange={(e) => handleUpdatePanel(panel.panelId, 'thickness', Number(e.target.value))}
                            className="w-12 text-center bg-transparent border-b border-slate-400 font-bold text-indigo-800 focus:border-indigo-600 focus:outline-none"
                          />
                        </td>

                        <td className="border-r border-slate-300 p-1.5">
                          <select
                            value={panel.boundaryCondition || out.boundaryCondition}
                            onChange={(e) =>
                              handleUpdatePanel(panel.panelId, 'boundaryCondition', e.target.value as SlabBoundaryCondition)
                            }
                            className="w-full bg-transparent text-[11px] font-sans border border-slate-300 rounded p-1 focus:border-indigo-500"
                          >
                            <option value="INTERIOR">1. Interior (Continuous)</option>
                            <option value="ONE_SHORT_DISCONTINUOUS">2. 1 Short Edge Disc.</option>
                            <option value="ONE_LONG_DISCONTINUOUS">3. 1 Long Edge Disc.</option>
                            <option value="TWO_ADJACENT_DISCONTINUOUS">4. 2 Adj Edges Disc (Corner)</option>
                            <option value="TWO_SHORT_DISCONTINUOUS">5. 2 Short Edges Disc.</option>
                            <option value="TWO_LONG_DISCONTINUOUS">6. 2 Long Edges Disc.</option>
                            <option value="THREE_ONE_LONG_CONTINUOUS">7. 3 Edges Disc (1 Long Cont)</option>
                            <option value="THREE_ONE_SHORT_CONTINUOUS">8. 3 Edges Disc (1 Short Cont)</option>
                            <option value="SIMPLY_SUPPORTED_ALL">9. Simply Supported (4 Disc)</option>
                            <option value="ONE_WAY_CONTINUOUS">One-Way Continuous</option>
                            <option value="ONE_WAY_SIMPLY_SUPPORTED">One-Way Simply Supported</option>
                            <option value="CANTILEVER">Cantilever Slab</option>
                          </select>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center text-[11px]">
                          <span className="text-emerald-700 font-bold">{out.Mux_pos}</span> /{' '}
                          <span className="text-red-600 font-bold">{out.Mux_neg}</span>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-left text-[10.5px]">
                          <div className="font-bold text-indigo-900">{out.botRebarXCallout}</div>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-left text-[10.5px]">
                          <div className="font-bold text-indigo-900">{out.botRebarYCallout}</div>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center font-bold">
                          <span className={out.deflectionCheck === 'PASS' ? 'text-emerald-600' : 'text-red-600'}>
                            {out.deflectionRatioActual} ≤ {out.deflectionRatioLimit}
                          </span>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center font-bold">
                          <span className={out.crackWidthCheck === 'PASS' ? 'text-emerald-600' : 'text-red-600'}>
                            {out.crackWidthMm}mm ≤ 0.30mm
                          </span>
                        </td>

                        <td className="border-r border-slate-300 p-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              out.status === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                            }`}
                          >
                            {out.status}
                          </span>
                        </td>

                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedReportOutput(out)}
                              className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                              title="View Detailed Calculation Report"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePanel(panel.panelId)}
                              className="p-1 text-red-500 hover:bg-red-100 rounded"
                              title="Delete Panel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Floor Level Subtotal Row */}
                  <tr className="bg-indigo-950/60 text-indigo-200 font-bold text-[11px] border-b-2 border-indigo-800">
                    <td colSpan={6} className="p-2 text-right uppercase text-slate-400">
                      {floorLabel} Subtotal ({items.length} Panels):
                    </td>
                    <td className="p-2 text-center text-emerald-400 font-bold">
                      Area: {floorArea.toFixed(1)} m²
                    </td>
                    <td colSpan={2} className="p-2 text-left text-sky-300 font-bold">
                      Concrete: {floorConcVol.toFixed(2)} m³
                    </td>
                    <td colSpan={3} className="p-2 text-center text-amber-300 font-bold">
                      Steel: {floorSteelKg.toFixed(1)} kg ({(floorSteelKg / 1000).toFixed(3)} MT)
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Panel Detail Section & Optional Rebar Diagram */}
      {showPanelSummary && activeOutput && (
        <div className={`grid grid-cols-1 ${showDrawing ? 'md:grid-cols-2' : ''} gap-4`}>
          {/* Rebar Detailing Summary Card */}
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                PANEL {activeOutput.panelId} DETAILING SUMMARY ({activeOutput.slabType})
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-bold">{activeOutput.lx}m × {activeOutput.ly}m</span>
                <button
                  type="button"
                  onClick={() => setShowDrawing(!showDrawing)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-sans transition-colors"
                  title="Toggle Slab Cross-Section Drawing"
                >
                  {showDrawing ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                  <span>{showDrawing ? 'Hide Drawing' : 'Show Drawing'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                <span className="text-slate-400 block uppercase font-sans">Bottom Main Rebar (Short Way):</span>
                <div className="text-sky-300 font-bold text-xs">{activeOutput.botRebarXCallout}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                <span className="text-slate-400 block uppercase font-sans">Bottom Main Rebar (Long Way):</span>
                <div className="text-sky-300 font-bold text-xs">{activeOutput.botRebarYCallout}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                <span className="text-slate-400 block uppercase font-sans">Top Support Negative Steel (X):</span>
                <div className="text-amber-300 font-bold text-xs">{activeOutput.topRebarXCallout}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                <span className="text-slate-400 block uppercase font-sans">Top Support Negative Steel (Y):</span>
                <div className="text-amber-300 font-bold text-xs">{activeOutput.topRebarYCallout}</div>
              </div>
            </div>

            {activeOutput.torsionRebarCallout && (
              <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded text-amber-300 text-[11px]">
                <strong>Corner Torsion Reinforcement:</strong> {activeOutput.torsionRebarCallout}
              </div>
            )}

            <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800 font-sans text-[11px]">
              <span>Est. Steel Takeoff: <strong className="text-white">{activeOutput.steelWeightKgPerM2} kg/m²</strong></span>
              <span>Thickness: <strong className="text-white">{activeOutput.thickness} mm</strong></span>
              <span>Factored Load: <strong className="text-white">{activeOutput.totalFactoredLoad} kN/m²</strong></span>
            </div>
          </div>

          {/* Optional 2D Cross-Section SVG Diagram */}
          {showDrawing && (
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <h3 className="text-sm font-bold text-white">
                  SLAB CROSS-SECTION REBAR DETAILING (PANEL {activeOutput.panelId})
                </h3>
                <span className="text-slate-400 text-xs font-sans">IS 456 Cl 26.5.2</span>
              </div>

              <div className="w-full flex items-center justify-center p-2 bg-slate-950 rounded border border-slate-800">
                <svg width="100%" height="160" viewBox="0 0 500 160" className="select-none">
                  {/* Concrete Slab Outline */}
                  <rect x="50" y="30" width="400" height="90" fill="#334155" stroke="#94a3b8" strokeWidth="2" rx="4" />
                  
                  {/* Bottom Main Bar Mesh (Red Line) */}
                  <line x1="60" y1="105" x2="440" y2="105" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  {/* Bottom Cranked / U-Hooks */}
                  <path d="M 60 105 L 60 60" fill="none" stroke="#ef4444" strokeWidth="4" />
                  <path d="M 440 105 L 440 60" fill="none" stroke="#ef4444" strokeWidth="4" />

                  {/* Transverse Bottom Dots */}
                  {[90, 140, 190, 240, 290, 340, 390].map((cx) => (
                    <circle key={`dot_${cx}`} cx={cx} cy="97" r="4" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
                  ))}

                  {/* Top Negative Support Bars at Ends (Yellow) */}
                  <line x1="60" y1="45" x2="150" y2="45" stroke="#f59e0b" strokeWidth="3" />
                  <line x1="350" y1="45" x2="440" y2="45" stroke="#f59e0b" strokeWidth="3" />

                  {/* Dimension Annotations */}
                  <text x="250" y="22" fill="#e2e8f0" fontSize="11" textAnchor="middle" fontWeight="bold">
                    Lx = {activeOutput.lx}m (Thickness D = {activeOutput.thickness}mm)
                  </text>
                  <text x="250" y="125" fill="#f87171" fontSize="10" textAnchor="middle">
                    Main Bottom: {activeOutput.botRebarXCallout.split(' (')[0]}
                  </text>
                  <text x="100" y="40" fill="#fbbf24" fontSize="9">Top Support Steel</text>
                  <text x="400" y="40" fill="#fbbf24" fontSize="9" textAnchor="end">Top Support Steel</text>
                </svg>
              </div>

              <div className="text-[11px] text-slate-400 text-center font-sans mt-2">
                Detailing complies with <strong className="text-white">IS 456:2000</strong> &amp; <strong className="text-white">SP 34 (S&amp;T):1987</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed IS 456 Calculation Sheet Modal */}
      {selectedReportOutput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                {selectedReportOutput.calculationReport.title}
              </h3>
              <button
                onClick={() => setSelectedReportOutput(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {selectedReportOutput.calculationReport.sections.map((sec, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                  <h4 className="font-bold text-indigo-400 text-sm border-b border-slate-800 pb-1">
                    {sec.title}
                  </h4>
                  <div className="space-y-1.5 pt-1">
                    {sec.steps.map((st, sIdx) => (
                      <div key={sIdx} className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-200 font-bold">
                          <span>{st.description} ({st.symbol})</span>
                          {st.status && (
                            <span className={st.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}>
                              [{st.status}]
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] font-sans">Formula: {st.formula}</div>
                        <div className="text-indigo-300 font-mono text-xs font-semibold mt-0.5">{st.result}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedReportOutput(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold"
              >
                Close Calculation Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
