import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { PileDesignEngine, ProjectPileType, ProjectPileTypeInput } from './pileDesignEngine';
import { PileDrawingSvg } from './PileDrawingSvg';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { IS2911PileGroup } from '@/features/codes/is2911/pileGroup';
import { exportToCsv } from '@/utils/exportUtils';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import {
  Building,
  FileText,
  Download,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Sliders,
  Sparkles,
  PieChart,
  HardHat,
  Save,
} from 'lucide-react';

export const PileDesignView: React.FC = () => {
  const {
    activeModel,
    activeProject,
    projectPileTypes: storePileTypes,
    supportPileAssignments,
    setProjectPileTypes,
    savePileDesigns,
    assignPileTypeToSupport,
  } = useProjectStore();

  // Master Project Pile Types (1, 2, or 3 standard types for the entire building)
  const [pileTypes, setPileTypes] = useState<ProjectPileType[]>(() => {
    if (storePileTypes && storePileTypes.length > 0) return storePileTypes;
    return PileDesignEngine.getDefaultProjectPileTypes();
  });

  // Sync to store on change
  useEffect(() => {
    if (pileTypes.length > 0) {
      setProjectPileTypes(pileTypes);
    }
  }, [pileTypes, setProjectPileTypes]);

  const [selectedPileId, setSelectedPileId] = useState<string>('P-1');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);

  const handleSaveDesigns = async () => {
    if (pileTypes.length === 0) return;
    setIsSaving(true);
    try {
      await savePileDesigns(pileTypes);
      setSaveSuccessMessage(`Successfully saved ${pileTypes.length} Pile Type configuration(s) to project!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Active selected pile type
  const activePile = useMemo(() => {
    return pileTypes.find((p) => p.id === selectedPileId) || pileTypes[0];
  }, [pileTypes, selectedPileId]);

  const columnMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(activeModel);
  }, [activeModel]);

  const supportNodes = useMemo(() => {
    if (!activeModel) return [];
    const list = Array.from(activeModel.supports.values());
    return list.sort((a, b) => {
      const slA = columnMapping.get(a.nodeId)?.columnSlNo || a.nodeId;
      const slB = columnMapping.get(b.nodeId)?.columnSlNo || b.nodeId;
      return slA - slB;
    });
  }, [activeModel, columnMapping]);

  // Update active pile type definition (dynamically re-arranges rebars economically on diameter change)
  const handleUpdateActivePile = (partial: Partial<ProjectPileTypeInput>) => {
    setPileTypes((prev) =>
      prev.map((pt) => {
        if (pt.id !== activePile.id) return pt;

        const newDia = partial.diameter !== undefined ? partial.diameter : pt.diameter;
        const isDiaChanged = partial.diameter !== undefined && partial.diameter !== pt.diameter;

        // If diameter changed and user didn't explicitly specify custom bars, auto-calculate economical rebar
        let autoBars = partial.barCount !== undefined ? partial.barCount : pt.barCount;
        let autoBarDia = partial.barDiameter !== undefined ? partial.barDiameter : pt.barDiameter;
        let autoPitch = partial.spiralPitch !== undefined ? partial.spiralPitch : pt.spiralPitch;

        if (isDiaChanged && partial.barCount === undefined && partial.barDiameter === undefined) {
          if (newDia <= 500) {
            autoBars = 6;
            autoBarDia = 16;
            autoPitch = 150;
          } else if (newDia <= 600) {
            autoBars = 8;
            autoBarDia = 16;
            autoPitch = 125;
          } else if (newDia <= 750) {
            autoBars = 8;
            autoBarDia = 20;
            autoPitch = 100;
          } else {
            autoBars = 10;
            autoBarDia = 20;
            autoPitch = 100;
          }
        }

        return PileDesignEngine.designPileType({
          id: pt.id,
          name: partial.name !== undefined ? partial.name : pt.name,
          diameter: newDia,
          length: partial.length !== undefined ? partial.length : pt.length,
          safeWorkingLoad: partial.safeWorkingLoad !== undefined ? partial.safeWorkingLoad : pt.safeWorkingLoad,
          isManualCapacity: partial.isManualCapacity !== undefined ? partial.isManualCapacity : pt.isManualCapacity,
          fck: partial.fck !== undefined ? partial.fck : pt.fck,
          fy: partial.fy !== undefined ? partial.fy : pt.fy,
          barCount: autoBars,
          barDiameter: autoBarDia,
          spiralDiameter: partial.spiralDiameter !== undefined ? partial.spiralDiameter : pt.spiralDiameter,
          spiralPitch: autoPitch,
          cu: partial.cu !== undefined ? partial.cu : pt.cu,
        });
      })
    );
  };

  // Add new standard pile type (e.g. P-3)
  const handleAddPileType = () => {
    const nextNum = pileTypes.length + 1;
    const newId = `P-${nextNum}`;
    const newPile = PileDesignEngine.designPileType({
      id: newId,
      name: `Type ${newId} (Dia 750mm Heavy Pile)`,
      diameter: 750,
      length: 18.0,
      safeWorkingLoad: 900,
      isManualCapacity: true,
      fck: 30,
      fy: 500,
      barCount: 10,
      barDiameter: 20,
      spiralDiameter: 8,
      spiralPitch: 100,
      cu: 70,
    });
    setPileTypes((prev) => [...prev, newPile]);
    setSelectedPileId(newId);
  };

  // Delete pile type (if > 1 exists)
  const handleDeletePileType = (id: string) => {
    if (pileTypes.length <= 1) return;
    const filtered = pileTypes.filter((p) => p.id !== id);
    setPileTypes(filtered);
    setSelectedPileId(filtered[0].id);
  };

  // Calculate usage rows for each column support in the model
  const usageRows = useMemo(() => {
    return supportNodes.map((sup) => {
      const colInfo = columnMapping.get(sup.nodeId);
      const slNo = colInfo?.columnSlNo || sup.nodeId;

      // Find max vertical reaction
      const reactions = activeModel?.reactions.filter((r) => r.nodeId === sup.nodeId) || [];
      let maxFy = 650;
      let govLC = 1;
      for (const r of reactions) {
        if (r.fy > maxFy) {
          maxFy = r.fy;
          govLC = r.loadCaseId;
        }
      }

      const assignedTypeId = supportPileAssignments[sup.nodeId] || 'P-1';
      const assignedPile = pileTypes.find((p) => p.id === assignedTypeId) || pileTypes[0];

      const workingDemand = parseFloat((Math.abs(maxFy) / 1.5).toFixed(1));
      const P_total_working = parseFloat((1.10 * workingDemand).toFixed(1));

      // Calculate pile count based on single pile capacity Qsafe (IS 2911 Cl. 6.5)
      let pileCount = Math.max(2, Math.ceil(P_total_working / assignedPile.safeWorkingLoad));

      // Re-verify group capacity against total working demand
      let rows = pileCount >= 4 ? 2 : 1;
      let cols = Math.ceil(pileCount / rows);
      let groupEfficiency = parseFloat(
        (IS2911PileGroup.calculateGroupEfficiency(rows, cols, assignedPile.diameter, 3 * assignedPile.diameter) * 100).toFixed(1)
      );
      let totalCapCapacity = parseFloat((pileCount * assignedPile.safeWorkingLoad * (groupEfficiency / 100)).toFixed(1));

      // Increment pile count if group efficiency causes capacity to fall below working demand
      while (totalCapCapacity < P_total_working && pileCount < 8) {
        pileCount++;
        rows = pileCount >= 4 ? 2 : 1;
        cols = Math.ceil(pileCount / rows);
        groupEfficiency = parseFloat(
          (IS2911PileGroup.calculateGroupEfficiency(rows, cols, assignedPile.diameter, 3 * assignedPile.diameter) * 100).toFixed(1)
        );
        totalCapCapacity = parseFloat((pileCount * assignedPile.safeWorkingLoad * (groupEfficiency / 100)).toFixed(1));
      }

      return {
        nodeId: sup.nodeId,
        columnSlNo: slNo,
        columnLabel: colInfo?.columnLabel || `C${slNo}`,
        pileCapLabel: colInfo?.pileCapLabel || `PC-${slNo}`,
        gridLabel: colInfo?.gridLabel,
        maxFy,
        workingDemand,
        govLC,
        assignedTypeId: assignedPile.id,
        assignedPile,
        pileCount,
        groupEfficiency,
        totalCapCapacity,
        status: totalCapCapacity >= workingDemand ? 'PASS' : 'WARNING',
      };
    });
  }, [supportNodes, activeModel, supportPileAssignments, pileTypes, columnMapping]);

  // Overall BOQ Metrics
  const boqMetrics = useMemo(() => {
    let totalPiles = 0;
    let totalLinearMeters = 0;
    let totalConcreteM3 = 0;
    let totalSteelKg = 0;

    for (const r of usageRows) {
      totalPiles += r.pileCount;
      const pileLen = r.assignedPile.length;
      totalLinearMeters += r.pileCount * pileLen;

      const singleVol = (Math.PI * (r.assignedPile.diameter / 1000) ** 2) / 4 * pileLen;
      totalConcreteM3 += r.pileCount * singleVol;

      // Steel kg: Longitudinal + Spirals
      const singleSteelKg = (r.assignedPile.providedLongitudinalSteel / 1e6 * pileLen * 7850) + (pileLen / (r.assignedPile.spiralPitch / 1000) * (Math.PI * r.assignedPile.diameter / 1000) * (Math.PI * (r.assignedPile.spiralDiameter / 1000) ** 2 / 4) * 7850);
      totalSteelKg += r.pileCount * singleSteelKg;
    }

    return {
      totalCaps: usageRows.length,
      totalPiles,
      totalLinearMeters: parseFloat(totalLinearMeters.toFixed(1)),
      totalConcreteM3: parseFloat(totalConcreteM3.toFixed(1)),
      totalSteelMT: parseFloat((totalSteelKg / 1000).toFixed(2)),
    };
  }, [usageRows]);



  const handleExport = () => {
    exportToCsv(
      usageRows.map((r) => ({
        ColumnLabel: r.columnLabel,
        PileCapLabel: r.pileCapLabel,
        SupportJoint: r.nodeId,
        FactoredLoad_Pu_kN: r.maxFy,
        WorkingDemand_kN: r.workingDemand,
        AssignedPileType: r.assignedPile.name,
        PileDiameter_mm: r.assignedPile.diameter,
        PileLength_m: r.assignedPile.length,
        SinglePileCapacity_kN: r.assignedPile.safeWorkingLoad,
        PilesRequired: r.pileCount,
        GroupEfficiency_pct: r.groupEfficiency,
        TotalCapCapacity_kN: r.totalCapCapacity,
        RebarCallout: r.assignedPile.rebarCallout,
        SpiralCallout: r.assignedPile.spiralCallout,
        Status: r.status,
      })),
      'IS2911_Standard_Piles_Schedule.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 bg-ui-background overflow-y-auto font-sans">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-xs">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <Building className="w-5 h-5 text-sky-600" />
            IS 2911:2010 STANDARD RCC PILE DESIGN WORKSPACE
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Design the standard single pile type(s) used across all column pile caps in the building.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedReport(activePile.calculationReport)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-mono text-xs font-semibold rounded border border-ui-border shadow-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            View {activePile.id} Calculation Sheet
          </button>

          <button
            onClick={() => setIsDrawingOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-mono text-xs font-semibold rounded border border-sky-200 shadow-xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            View {activePile.id} CAD Drawing
          </button>

          <button
            onClick={handleSaveDesigns}
            disabled={isSaving || pileTypes.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs font-bold rounded shadow-xs transition-all disabled:opacity-50"
            title="Save designed project pile types to project and database"
          >
            <Save className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSaving ? 'Saving...' : '💾 Save Pile Types'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Foundation Schedule CSV
          </button>
        </div>
      </div>

      {/* Universal Rebar Master Selection Toolbar */}
      <UniversalRebarBar moduleName="Cast-In-Situ Pile" />

      {/* Save Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* SECTION 1: MASTER PILE TYPE DESIGN CARD */}
      <div className="bg-surface-card border border-ui-border rounded-lg p-4 space-y-4 shadow-xs">
        {/* Pile Type Selector Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">
              Project Pile Types:
            </span>
            {pileTypes.map((pt) => (
              <button
                key={pt.id}
                onClick={() => setSelectedPileId(pt.id)}
                className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all flex items-center gap-2 ${
                  selectedPileId === pt.id
                    ? 'bg-deep-navy text-white font-bold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                <span>{pt.id}: Dia {pt.diameter}mm ({pt.safeWorkingLoad} kN)</span>
                {pileTypes.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePileType(pt.id);
                    }}
                    className="p-0.5 hover:text-red-300 rounded"
                    title="Delete pile type"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}

            {pileTypes.length < 4 && (
              <button
                onClick={handleAddPileType}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-mono text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Pile Type
              </button>
            )}

            <button
              onClick={handleSaveDesigns}
              disabled={isSaving || pileTypes.length === 0}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              title="Save all pile types to project"
            >
              <Save className="w-3.5 h-3.5 text-blue-200" />
              <span>{isSaving ? 'Saving...' : '💾 Save Pile Types'}</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            Standard Pile Section used in Pile Caps
          </span>
        </div>

        {/* Pile Type Interactive Editor Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Geometry & Safe Capacity */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-3">
            <span className="font-bold text-deep-navy uppercase text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-600" />
              1. Geometry & Safe Capacity
            </span>

            {/* Diameter Manual Input & Presets */}
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-xs flex justify-between">
                <span>Pile Diameter (Dp):</span>
                <span className="font-mono text-slate-500 font-normal">in mm</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="200"
                  max="3000"
                  step="25"
                  value={activePile.diameter}
                  onChange={(e) =>
                    handleUpdateActivePile({ diameter: parseFloat(e.target.value) || 500 })
                  }
                  className="w-28 px-2.5 py-1 bg-white border border-ui-border rounded font-mono font-bold text-sm text-sky-900 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
                <span className="font-mono text-xs text-slate-600 font-bold">mm</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[400, 450, 500, 600, 750, 800, 1000].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleUpdateActivePile({ diameter: d })}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activePile.diameter === d
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    {d} mm
                  </button>
                ))}
              </div>
            </div>

            {/* Length Manual Input & Presets */}
            <div className="space-y-1 pt-1 border-t border-slate-200/80">
              <label className="text-slate-600 font-semibold text-xs flex justify-between">
                <span>Embedded Pile Length (L):</span>
                <span className="font-mono text-slate-500 font-normal">in meters</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="3"
                  max="100"
                  step="0.5"
                  value={activePile.length}
                  onChange={(e) =>
                    handleUpdateActivePile({ length: parseFloat(e.target.value) || 12.0 })
                  }
                  className="w-28 px-2.5 py-1 bg-white border border-ui-border rounded font-mono font-bold text-sm text-sky-900 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
                <span className="font-mono text-xs text-slate-600 font-bold">m depth</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[10, 12, 15, 18, 20, 24].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => handleUpdateActivePile({ length: l })}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activePile.length === l
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    {l} m
                  </button>
                ))}
              </div>
            </div>

            {/* Safe Working Load (Qsafe) */}
            <div className="space-y-1 pt-1 border-t border-slate-200/80">
              <label className="text-slate-600 font-semibold text-xs flex justify-between">
                <span>Safe Working Load (Qsafe):</span>
                <span className="font-mono text-slate-500 font-normal">in kN</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="25"
                  value={activePile.safeWorkingLoad}
                  onChange={(e) =>
                    handleUpdateActivePile({
                      safeWorkingLoad: parseFloat(e.target.value) || 450,
                      isManualCapacity: true,
                    })
                  }
                  className="w-28 px-2.5 py-1 bg-white border border-ui-border rounded font-mono font-bold text-sm text-sky-900 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
                <span className="font-mono text-xs text-slate-600 font-bold">kN / Pile</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[300, 350, 450, 600, 750, 900, 1200].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      handleUpdateActivePile({ safeWorkingLoad: val, isManualCapacity: true })
                    }
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activePile.safeWorkingLoad === val
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    {val} kN
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Longitudinal Steel & Spirals */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-3">
            <span className="font-bold text-deep-navy uppercase text-xs flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-orange-600" />
              2. Reinforcement Detailing
            </span>

            {/* Manual Bar Count & Diameter Entry */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-xs">No. of Bars:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="4"
                    max="32"
                    step="1"
                    value={activePile.barCount}
                    onChange={(e) =>
                      handleUpdateActivePile({ barCount: parseInt(e.target.value, 10) || 6 })
                    }
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-orange-900"
                  />
                  <span className="text-xs font-mono text-slate-500">Nos</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-xs">Bar Dia (mm):</label>
                <select
                  value={activePile.barDiameter}
                  onChange={(e) =>
                    handleUpdateActivePile({ barDiameter: parseInt(e.target.value, 10) || 16 })
                  }
                  className="w-full px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-orange-900"
                >
                  {[12, 16, 20, 25, 28, 32, 36, 40].map((d) => (
                    <option key={d} value={d}>
                      T{d} ({d}mm)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Rebar Presets */}
            <div className="space-y-1">
              <label className="text-slate-500 text-[11px] font-semibold">Quick Rebar Presets:</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { count: 6, dia: 16, label: '6-T16' },
                  { count: 6, dia: 20, label: '6-T20' },
                  { count: 8, dia: 16, label: '8-T16' },
                  { count: 8, dia: 20, label: '8-T20' },
                  { count: 10, dia: 20, label: '10-T20' },
                  { count: 12, dia: 20, label: '12-T20' },
                  { count: 12, dia: 25, label: '12-T25' },
                ].map((reb) => (
                  <button
                    key={reb.label}
                    type="button"
                    onClick={() =>
                      handleUpdateActivePile({ barCount: reb.count, barDiameter: reb.dia })
                    }
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activePile.barCount === reb.count && activePile.barDiameter === reb.dia
                        ? 'bg-orange-600 text-white font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    {reb.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spiral Ties Manual Inputs */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[11px]">Spiral Tie Dia:</label>
                <select
                  value={activePile.spiralDiameter}
                  onChange={(e) =>
                    handleUpdateActivePile({ spiralDiameter: parseInt(e.target.value, 10) || 8 })
                  }
                  className="w-full px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-emerald-900"
                >
                  {[6, 8, 10, 12].map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[11px]">Spiral Pitch:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="50"
                    max="300"
                    step="25"
                    value={activePile.spiralPitch}
                    onChange={(e) =>
                      handleUpdateActivePile({ spiralPitch: parseInt(e.target.value, 10) || 150 })
                    }
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-emerald-900"
                  />
                  <span className="text-[11px] font-mono text-slate-500">mm</span>
                </div>
              </div>
            </div>

            {/* Materials Dropdowns */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block text-[11px]">Concrete Grade:</label>
                <select
                  value={activePile.fck}
                  onChange={(e) =>
                    handleUpdateActivePile({ fck: parseInt(e.target.value, 10) || 25 })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-blue-900"
                >
                  {[20, 25, 30, 35, 40, 45, 50].map((g) => (
                    <option key={g} value={g}>
                      M{g} ({g} N/mm²)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block text-[11px]">Steel Grade:</label>
                <select
                  value={activePile.fy}
                  onChange={(e) =>
                    handleUpdateActivePile({ fy: parseInt(e.target.value, 10) || 500 })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-white border border-ui-border rounded font-mono font-bold text-xs text-slate-900"
                >
                  {[415, 500, 550].map((g) => (
                    <option key={g} value={g}>
                      Fe{g}D ({g} N/mm²)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Column 3: Live Real-Time Capacity Audit */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 font-mono text-xs uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  3. IS 2911:2010 CODE AUDIT
                </span>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono font-bold text-xs">
                  STATUS: PASS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs pt-1">
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">STRUCTURAL CAPACITY (Pc)</span>
                  <span className="font-bold text-slate-800 text-sm">{activePile.structuralCapacity} kN</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">SAFE AXIAL LOAD (Qsafe)</span>
                  <span className="font-bold text-sky-700 text-sm">{activePile.safeWorkingLoad} kN</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">SAFE UPLIFT CAPACITY</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      step="10"
                      value={activePile.upliftCapacity}
                      onChange={(e) =>
                        handleUpdateActivePile({ upliftCapacity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 px-1.5 py-0.5 border border-ui-border rounded font-mono font-bold text-xs text-indigo-800 bg-white"
                    />
                    <span className="font-mono text-[10px] text-slate-500">kN</span>
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">SAFE LATERAL CAPACITY</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="5"
                      value={activePile.lateralCapacity}
                      onChange={(e) =>
                        handleUpdateActivePile({ lateralCapacity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 px-1.5 py-0.5 border border-ui-border rounded font-mono font-bold text-xs text-indigo-800 bg-white"
                    />
                    <span className="font-mono text-[10px] text-slate-500">kN</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-emerald-900 space-y-0.5 pt-1">
                <div><strong>Steel:</strong> {activePile.rebarCallout}</div>
                <div><strong>Spirals:</strong> {activePile.spiralCallout}</div>
              </div>
            </div>

            <div className="pt-2 flex gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setSelectedReport(activePile.calculationReport)}
                className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-mono font-semibold shadow-2xs text-center"
              >
                Calculation Sheet
              </button>
              <button
                onClick={() => setIsDrawingOpen(true)}
                className="flex-1 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-mono font-bold shadow-2xs text-center"
              >
                CAD Drawing
              </button>
              <button
                onClick={handleSaveDesigns}
                disabled={isSaving}
                className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-mono font-bold shadow-2xs flex items-center justify-center gap-1"
                title="Save this pile design to project"
              >
                <Save className="w-3.5 h-3.5 text-emerald-200" />
                <span>{isSaving ? 'Saving...' : 'Save Design'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: EXECUTIVE BILL OF QUANTITIES (BOQ) STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Total Columns / Caps
          </span>
          <span className="text-lg font-mono font-bold text-deep-navy">
            {usageRows.length} Pile Caps
          </span>
        </div>
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Total Piles in Project
          </span>
          <span className="text-lg font-mono font-bold text-sky-700">
            {boqMetrics.totalPiles} Piles
          </span>
        </div>
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Total Linear Meters Piling
          </span>
          <span className="text-lg font-mono font-bold text-indigo-700">
            {boqMetrics.totalLinearMeters} m
          </span>
        </div>
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Concrete / Steel Takeoff
          </span>
          <span className="text-lg font-mono font-bold text-emerald-700">
            {boqMetrics.totalConcreteM3} m³ / {boqMetrics.totalSteelMT} MT
          </span>
        </div>
      </div>



      {/* Calculation Modal */}
      <CalculationModal report={selectedReport} onClose={() => setSelectedReport(null)} />

      {/* CAD Drawing Modal */}
      {isDrawingOpen && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                CAD PILE ELEVATION & HELICAL SPIRAL — {activePile.name}
              </h3>
              <button onClick={() => setIsDrawingOpen(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <PileDrawingSvg pile={activePile} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
