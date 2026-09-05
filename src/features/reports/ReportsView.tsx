import React, { useMemo, useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { ExcelWorkbookExporter } from './excelExport';
import { PDFReportGenerator } from './pdfReportGenerator';
import { CalculationPdfService } from '@/features/calculations/calculationPdfService';
import { ConcreteVolumeEngine, ConcreteComponentVolume } from '@/features/calculations/concreteVolumeEngine';
import { BoqEngine } from '@/features/calculations/boqEngine';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { ArchitecturalTakeoffEngine } from '@/features/architectural/engines/architecturalTakeoffEngine';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { exportToCsv } from '@/utils/exportUtils';
import {
  FileSpreadsheet,
  Printer,
  Download,
  CheckCircle2,
  Layers,
  Building,
  Box,
  ShieldCheck,
  FileText,
  Sparkles,
  Hash,
  BookOpen,
  PieChart,
  HardHat,
  Droplets,
  Layers3,
  ChevronDown,
  ChevronUp,
  Calculator,
  DoorOpen,
  AppWindow,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    activeProject,
    activeModel,
    architecturalWalls,
    architecturalDoors,
    architecturalWindows,
    architecturalOpenings,
    architecturalRooms,
  } = useProjectStore();
  const [concreteViewMode, setConcreteViewMode] = useState<'BY_COMPONENT' | 'BY_FLOOR' | 'ITEMIZED' | 'MEASUREMENT_SHEET'>('BY_COMPONENT');
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null);

  if (!activeProject || !activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active model loaded.
      </div>
    );
  }

  const dataset = useMemo(() => ({
    metadata: activeProject.metadata,
    model: activeModel,
    warnings: activeProject.warnings,
    manualMergedPileCapGroups: activeProject.manualMergedPileCapGroups,
    detachedCombinedCapNodeIds: activeProject.detachedCombinedCapNodeIds,
    customCombinedCapOverrides: activeProject.customCombinedCapOverrides,
    projectPileTypes: activeProject.projectPileTypes,
    savedColumnDesigns: activeProject.savedColumnDesigns,
    savedBeamDesigns: activeProject.savedBeamDesigns,
    savedShearWallDesigns: activeProject.savedShearWallDesigns,
    savedGradeBeamDesigns: activeProject.savedGradeBeamDesigns,
    savedFootingDesigns: activeProject.savedFootingDesigns,
    savedSlabDesigns: activeProject.savedSlabDesigns,
    universalRebarSelection: activeProject.universalRebarSelection,
    customColumnRebarOverrides: activeProject.customColumnRebarOverrides,
  }), [activeProject, activeModel]);

  const reportData = useMemo(() => {
    return PDFReportGenerator.calculateAllComponentDesigns(
      activeModel,
      activeProject.metadata.designSettings,
      dataset
    );
  }, [activeModel, activeProject, dataset]);

  const archTakeoff = useMemo(() => {
    const fps = FloorPlanEngine.extractFloorPlans(activeModel);
    return ArchitecturalTakeoffEngine.calculateBuildingTakeoff(
      architecturalWalls || {},
      architecturalDoors || {},
      architecturalWindows || {},
      architecturalOpenings || {},
      architecturalRooms || {},
      fps
    );
  }, [activeModel, architecturalWalls, architecturalDoors, architecturalWindows, architecturalOpenings, architecturalRooms]);

  const concreteSummary = useMemo(() => {
    return ConcreteVolumeEngine.calculateBuildingConcreteSummary(
      activeModel,
      activeProject.metadata,
      dataset
    );
  }, [activeModel, activeProject, dataset]);

  const boqEstimate = useMemo(() => {
    return BoqEngine.generateBuildingBoq(activeModel, undefined, activeProject.metadata.name);
  }, [activeModel, activeProject]);

  const handleExportBoqMeasurementCsv = () => {
    const csvRows = boqEstimate.measurementSheet.map((m) => ({
      ItemNo: m.itemNo,
      Description: m.description,
      Category: m.sourceCategory,
      Nos: m.nos,
      Length_m: m.lengthM,
      Breadth_m: m.breadthM,
      HeightOrDepth_m: m.heightOrDepthM,
      Quantity: m.quantity,
      Unit: m.unit,
      UnitRate_INR: m.unitRateInr,
      TotalAmount_INR: m.totalAmountInr,
      CodeRef: m.codeReference || '',
      FormulaNote: m.formulaNote || '',
    }));
    exportToCsv(csvRows, `${activeProject.metadata.code || 'PRJ'}_BOQ_Measurement_Sheet_LBH.csv`);
  };

  const handleDownloadExcel = () => {
    ExcelWorkbookExporter.downloadWorkbook(dataset as any);
  };

  const handleDownloadA4Pdf = () => {
    PDFReportGenerator.exportA4PdfReport(dataset as any);
  };

  const handleDownloadAllCalculationsPdf = () => {
    CalculationPdfService.exportAllDesignCalculationsPdf(activeModel, activeProject);
  };

  const handleDownloadColumnsPdf = () => {
    CalculationPdfService.exportColumnsCalculationsPdf(activeModel, activeProject);
  };

  const handleDownloadBeamsPdf = () => {
    CalculationPdfService.exportBeamsCalculationsPdf(activeModel, activeProject);
  };

  const handleDownloadPilesPdf = () => {
    CalculationPdfService.exportPilesCalculationsPdf(activeModel, activeProject);
  };

  const handleDownloadPileCapsPdf = () => {
    CalculationPdfService.exportPileCapsCalculationsPdf(activeModel, activeProject);
  };

  const handlePrintReport = () => {
    PDFReportGenerator.printProjectReport(dataset as any);
  };

  const handleExportConcreteCsv = () => {
    const csvRows = concreteSummary.components.map((c) => ({
      Component: c.component,
      Category: c.category,
      CodeClause: c.codeRef,
      ElementCount: c.count,
      TypicalDimensions: c.typicalDimensions,
      Grade: c.concreteGrade,
      ConcreteVolume_m3: c.concreteM3,
      PercentageShare: `${c.percentageShare}%`,
      FormworkArea_m2: c.formworkM2,
      CementBags_50kg: c.cementBags,
      Sand_m3: c.sandM3,
      Sand_MT: c.sandMT,
      CoarseAggregate_m3: c.aggregateM3,
      CoarseAggregate_MT: c.aggregateMT,
      Water_Liters: c.waterLiters,
    }));

    exportToCsv(csvRows, `${activeProject.metadata.code || 'PRJ'}_Concrete_Volume_Schedule_BOQ.csv`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-ui-background font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
          <div>
            <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              COMPREHENSIVE A4 STRUCTURAL REPORTS &amp; DETAILED DESIGN CALCULATIONS
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-page A4 PDF engineering report with 2D plans, separate concrete volume schedule ($m^3$), diameter-wise rebar take-off, and IS calculations.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Tap Master Design Calculations PDF */}
            <button
              onClick={handleDownloadAllCalculationsPdf}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-mono text-xs font-bold rounded shadow transition-all"
              title="1-Tap Design Calculation PDF Export for ALL Columns, Beams, Piles & Pile Caps"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>1-Tap All Calculations PDF</span>
            </button>

            <button
              onClick={handleDownloadA4Pdf}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold rounded shadow transition-all"
              title="Download direct vector A4 PDF with 2D drawings & calculations"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              Download A4 Summary PDF
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-mono text-xs font-semibold rounded border border-ui-border shadow-sm transition-colors"
              title="Open browser print & save-as-PDF dialog in A4 layout"
            >
              <Printer className="w-3.5 h-3.5 text-secondary-brand" />
              Print / Preview A4
            </button>

            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel (.xls)
            </button>
          </div>
        </div>

        {/* Universal Rebar Master Selection Toolbar */}
        <UniversalRebarBar moduleName="Reports & BOQ Take-Off" />

        {/* Bill of Quantities (BOQ) Master Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Concrete */}
          <div className="bg-surface-card p-4 rounded-md border border-ui-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                Total Concrete (RCC)
              </span>
              <Box className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-3">
              <span className="font-mono text-2xl font-bold text-deep-navy">{concreteSummary.grandTotalConcreteM3.toFixed(1)}</span>
              <span className="font-mono text-xs text-slate-500 ml-1">m³</span>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-500">
                <span className="text-emerald-700 font-semibold">Sub: {concreteSummary.substructureConcreteM3.toFixed(1)} m³ ({concreteSummary.substructurePercent}%)</span>
                <span>•</span>
                <span className="text-sky-700 font-semibold">Super: {concreteSummary.superstructureConcreteM3.toFixed(1)} m³ ({concreteSummary.superstructurePercent}%)</span>
              </div>
            </div>
          </div>

          {/* Formwork & Shuttering Area */}
          <div className="bg-surface-card p-4 rounded-md border border-ui-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                Total Shuttering Area
              </span>
              <Layers3 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-3">
              <span className="font-mono text-2xl font-bold text-amber-700">{concreteSummary.totalFormworkM2.toFixed(0)}</span>
              <span className="font-mono text-xs text-slate-500 ml-1">m²</span>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                {(concreteSummary.totalFormworkM2 * 10.7639).toFixed(0)} sq.ft formwork contact area
              </p>
            </div>
          </div>

          {/* Cement Bags */}
          <div className="bg-surface-card p-4 rounded-md border border-ui-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                Cement Bags (50kg)
              </span>
              <HardHat className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-3">
              <span className="font-mono text-2xl font-bold text-indigo-700">{concreteSummary.totalCementBags.toLocaleString()}</span>
              <span className="font-mono text-xs text-slate-500 ml-1">Bags</span>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                {(concreteSummary.totalCementBags * 0.05).toFixed(1)} MT OPC/PPC Cement
              </p>
            </div>
          </div>

          {/* Total Steel & Intensity */}
          <div className="bg-surface-card p-4 rounded-md border border-ui-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                Steel Take-Off &amp; Index
              </span>
              <Hash className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <span className="font-mono text-2xl font-bold text-secondary-brand">{reportData.grandTotals.grandTotalMT.toFixed(2)}</span>
              <span className="font-mono text-xs text-slate-500 ml-1">MT</span>
              <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-1">
                Intensity: {(reportData.totalSteelKg / (concreteSummary.grandTotalConcreteM3 || 1)).toFixed(1)} kg/m³
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONCRETE VOLUME SCHEDULE & BOQ BREAKDOWN BY STRUCTURAL PART               */}
        {/* ========================================================================= */}
        <div className="bg-surface-card rounded-md border border-ui-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-sky-400" />
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                  CONCRETE VOLUME SCHEDULE &amp; BOQ BREAKDOWN BY STRUCTURAL PART (m³)
                </h3>
                <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                  Separate geometric volume calculation for every structural member category with material consumption &amp; formwork.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Switcher */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setConcreteViewMode('BY_COMPONENT')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    concreteViewMode === 'BY_COMPONENT' ? 'bg-secondary-brand text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  By Component
                </button>
                <button
                  type="button"
                  onClick={() => setConcreteViewMode('BY_FLOOR')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    concreteViewMode === 'BY_FLOOR' ? 'bg-secondary-brand text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Floor Distribution
                </button>
                <button
                  type="button"
                  onClick={() => setConcreteViewMode('ITEMIZED')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    concreteViewMode === 'ITEMIZED' ? 'bg-secondary-brand text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Itemized Members
                </button>
                <button
                  type="button"
                  onClick={() => setConcreteViewMode('MEASUREMENT_SHEET')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    concreteViewMode === 'MEASUREMENT_SHEET' ? 'bg-secondary-brand text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  L × B × H Measurement Sheet
                </button>
              </div>

              <button
                type="button"
                onClick={concreteViewMode === 'MEASUREMENT_SHEET' ? handleExportBoqMeasurementCsv : handleExportConcreteCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-mono font-semibold transition-colors"
                title={concreteViewMode === 'MEASUREMENT_SHEET' ? 'Export BOQ Measurement Sheet CSV' : 'Export detailed Concrete Volume CSV'}
              >
                <Download className="w-3.5 h-3.5" />
                {concreteViewMode === 'MEASUREMENT_SHEET' ? 'BOQ CSV' : 'CSV'}
              </button>
            </div>
          </div>

          {/* VIEW 1: BY STRUCTURAL COMPONENT */}
          {concreteViewMode === 'BY_COMPONENT' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-ui-border font-bold">
                    <th className="p-3">STRUCTURAL COMPONENT &amp; IS CODE</th>
                    <th className="p-3 text-center">CATEGORY</th>
                    <th className="p-3 text-center">COUNT</th>
                    <th className="p-3">TYPICAL SECTION / SPECS</th>
                    <th className="p-3 text-center">GRADE</th>
                    <th className="p-3 text-right text-sky-800 font-bold">CONCRETE (m³)</th>
                    <th className="p-3 text-center w-36">% SHARE</th>
                    <th className="p-3 text-right">FORMWORK (m²)</th>
                    <th className="p-3 text-right">CEMENT (Bags)</th>
                    <th className="p-3 text-right">SAND (m³)</th>
                    <th className="p-3 text-right">AGGREGATE (m³)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border text-slate-700">
                  {concreteSummary.components.map((row, idx) => (
                    <React.Fragment key={row.id}>
                      <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 hover:bg-slate-100/60'}>
                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{row.component}</span>
                            {row.itemizedMembers && row.itemizedMembers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedComponentId(expandedComponentId === row.id ? null : row.id)}
                                className="text-slate-400 hover:text-secondary-brand transition-colors p-0.5"
                                title="Toggle itemized member list"
                              >
                                {expandedComponentId === row.id ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] font-normal text-slate-500 block">{row.codeRef}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.category === 'SUPERSTRUCTURE'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {row.category}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">{row.count}</td>
                        <td className="p-3 text-slate-600">{row.typicalDimensions}</td>
                        <td className="p-3 text-center font-bold text-indigo-700">{row.concreteGrade}</td>
                        <td className="p-3 text-right font-mono font-bold text-sky-700 text-sm">
                          {row.concreteM3.toFixed(2)} m³
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-sky-600 h-full rounded-full"
                                style={{ width: `${Math.min(100, row.percentageShare)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 w-10 text-right">
                              {row.percentageShare}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">{row.formworkM2 > 0 ? row.formworkM2.toFixed(1) : '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-800">{row.cementBags}</td>
                        <td className="p-3 text-right font-mono">{row.sandM3.toFixed(1)}</td>
                        <td className="p-3 text-right font-mono">{row.aggregateM3.toFixed(1)}</td>
                      </tr>

                      {/* Inline Itemized Members Dropdown */}
                      {expandedComponentId === row.id && row.itemizedMembers && (
                        <tr className="bg-slate-900/5">
                          <td colSpan={11} className="p-3">
                            <div className="bg-white rounded border border-slate-300 p-3 max-h-48 overflow-y-auto space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 border-b pb-1">
                                <span>ITEMIZED {row.component.toUpperCase()} MEMBERS ({row.itemizedMembers.length})</span>
                                <span>NET CONCRETE VOL: {row.concreteM3.toFixed(2)} m³</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                                {row.itemizedMembers.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200">
                                    <div>
                                      <span className="font-bold text-slate-900">{item.label}</span>
                                      <span className="text-[10px] text-slate-500 block">{item.dimensions}</span>
                                    </div>
                                    <span className="font-bold text-sky-700">{item.volumeM3} m³</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Substructure Subtotal */}
                  <tr className="bg-amber-50/70 font-bold border-t border-amber-200 text-amber-950">
                    <td className="p-2.5">SUBSTRUCTURE TOTAL (FOUNDATIONS, PILES, GRADE BEAMS, PCC)</td>
                    <td className="p-2.5 text-center">SUBSTRUCTURE</td>
                    <td className="p-2.5 text-center">—</td>
                    <td className="p-2.5 text-slate-600">—</td>
                    <td className="p-2.5 text-center">M25/M30/M15</td>
                    <td className="p-2.5 text-right font-bold text-amber-900">{concreteSummary.substructureConcreteM3.toFixed(2)} m³</td>
                    <td className="p-2.5 text-center font-bold">{concreteSummary.substructurePercent}%</td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUBSTRUCTURE').reduce((s, c) => s + c.formworkM2, 0).toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right font-bold">
                      {concreteSummary.components.filter(c => c.category === 'SUBSTRUCTURE').reduce((s, c) => s + c.cementBags, 0)}
                    </td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUBSTRUCTURE').reduce((s, c) => s + c.sandM3, 0).toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUBSTRUCTURE').reduce((s, c) => s + c.aggregateM3, 0).toFixed(1)}
                    </td>
                  </tr>

                  {/* Superstructure Subtotal */}
                  <tr className="bg-sky-50/70 font-bold border-t border-sky-200 text-sky-950">
                    <td className="p-2.5">SUPERSTRUCTURE TOTAL (COLUMNS, BEAMS, SLABS, SHEAR WALLS)</td>
                    <td className="p-2.5 text-center">SUPERSTRUCTURE</td>
                    <td className="p-2.5 text-center">—</td>
                    <td className="p-2.5 text-slate-600">—</td>
                    <td className="p-2.5 text-center">{activeProject.metadata.designSettings.concreteGrade}</td>
                    <td className="p-2.5 text-right font-bold text-sky-900">{concreteSummary.superstructureConcreteM3.toFixed(2)} m³</td>
                    <td className="p-2.5 text-center font-bold">{concreteSummary.superstructurePercent}%</td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUPERSTRUCTURE').reduce((s, c) => s + c.formworkM2, 0).toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right font-bold">
                      {concreteSummary.components.filter(c => c.category === 'SUPERSTRUCTURE').reduce((s, c) => s + c.cementBags, 0)}
                    </td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUPERSTRUCTURE').reduce((s, c) => s + c.sandM3, 0).toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right">
                      {concreteSummary.components.filter(c => c.category === 'SUPERSTRUCTURE').reduce((s, c) => s + c.aggregateM3, 0).toFixed(1)}
                    </td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-800 text-xs">
                    <td className="p-3 font-extrabold uppercase text-amber-300">
                      GRAND TOTAL BUILDING CONCRETE (m³)
                    </td>
                    <td className="p-3 text-center text-slate-300">FULL BUILDING</td>
                    <td className="p-3 text-center">{concreteSummary.components.reduce((s, c) => s + c.count, 0)}</td>
                    <td className="p-3 text-slate-300">IS 456 / 13920 / 2911</td>
                    <td className="p-3 text-center text-amber-300">ALL GRADES</td>
                    <td className="p-3 text-right text-base text-amber-300 font-extrabold">
                      {concreteSummary.grandTotalConcreteM3.toFixed(2)} m³
                    </td>
                    <td className="p-3 text-center font-extrabold text-amber-300">100.0%</td>
                    <td className="p-3 text-right font-mono">{concreteSummary.totalFormworkM2.toFixed(1)} m²</td>
                    <td className="p-3 text-right font-mono text-amber-300 font-bold">{concreteSummary.totalCementBags}</td>
                    <td className="p-3 text-right font-mono">{concreteSummary.totalSandM3.toFixed(1)}</td>
                    <td className="p-3 text-right font-mono">{concreteSummary.totalAggregateM3.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: FLOOR-BY-FLOOR DISTRIBUTION */}
          {concreteViewMode === 'BY_FLOOR' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-ui-border font-bold">
                    <th className="p-3">FLOOR LEVEL</th>
                    <th className="p-3 text-right">ELEVATION (Y)</th>
                    <th className="p-3 text-right">COLUMNS (m³)</th>
                    <th className="p-3 text-right">BEAMS (m³)</th>
                    <th className="p-3 text-right">SLABS (m³)</th>
                    <th className="p-3 text-right">SHEAR WALLS (m³)</th>
                    <th className="p-3 text-right">FOUNDATIONS (m³)</th>
                    <th className="p-3 text-right text-sky-800 font-bold">TOTAL LEVEL VOL (m³)</th>
                    <th className="p-3 text-right">FORMWORK (m²)</th>
                    <th className="p-3 text-right">CEMENT (Bags)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border text-slate-700">
                  {concreteSummary.floorBreakdown.map((f, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="p-3 font-bold text-slate-900">
                        {f.levelName} {f.isFoundation && <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 ml-1">Foundation</span>}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">+{f.elevationY.toFixed(2)} m</td>
                      <td className="p-3 text-right font-mono">{f.columnsConcreteM3 > 0 ? f.columnsConcreteM3.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right font-mono">{f.beamsConcreteM3 > 0 ? f.beamsConcreteM3.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right font-mono">{f.slabsConcreteM3 > 0 ? f.slabsConcreteM3.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right font-mono">{f.shearWallsConcreteM3 > 0 ? f.shearWallsConcreteM3.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right font-mono">{f.foundationConcreteM3 > 0 ? f.foundationConcreteM3.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right font-mono font-bold text-sky-700">{f.totalFloorConcreteM3.toFixed(2)} m³</td>
                      <td className="p-3 text-right font-mono">{f.totalFormworkM2.toFixed(1)}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-800">{f.totalCementBags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 3: ITEMIZED MEMBERS */}
          {concreteViewMode === 'ITEMIZED' && (
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto font-mono text-xs">
              {concreteSummary.components.map((comp) => (
                <div key={comp.id} className="bg-slate-50 rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-900">{comp.component} ({comp.count} Members)</span>
                    <span className="font-bold text-sky-700">{comp.concreteM3.toFixed(2)} m³ ({comp.percentageShare}%)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    {comp.itemizedMembers?.map((item: any, i: number) => (
                      <div key={i} className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800 block">{item.label}</span>
                          <span className="text-[10px] text-slate-500">{item.dimensions}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sky-700 block">{item.volumeM3} m³</span>
                          <span className="text-[10px] text-slate-400">{item.formworkM2} m² form</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW 4: CIVIL ENGINEERING L × B × H MEASUREMENT SHEET (STAAD / BOQ) */}
          {concreteViewMode === 'MEASUREMENT_SHEET' && (
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-ui-border font-bold">
                    <th className="p-2.5">ITEM #</th>
                    <th className="p-2.5 min-w-[280px]">DESCRIPTION OF ITEM &amp; CODE CLAUSE</th>
                    <th className="p-2.5 text-center">CATEGORY</th>
                    <th className="p-2.5 text-center">NOS</th>
                    <th className="p-2.5 text-right">L (m)</th>
                    <th className="p-2.5 text-right">B (m)</th>
                    <th className="p-2.5 text-right">H/D (m)</th>
                    <th className="p-2.5 text-right text-sky-700">QUANTITY</th>
                    <th className="p-2.5 text-center">UNIT</th>
                    <th className="p-2.5 text-right">RATE (₹)</th>
                    <th className="p-2.5 text-right text-emerald-700 font-bold">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {boqEstimate.measurementSheet.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-bold text-slate-700">{row.itemNo}</td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-900">{row.description}</div>
                        {row.codeReference && (
                          <span className="text-[10px] text-slate-500">{row.codeReference}</span>
                        )}
                        {row.formulaNote && (
                          <span className="text-[10px] text-indigo-600 block">{row.formulaNote}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {row.sourceCategory}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-800">{row.nos}</td>
                      <td className="p-2.5 text-right">{row.lengthM.toFixed(2)}</td>
                      <td className="p-2.5 text-right">{row.breadthM.toFixed(2)}</td>
                      <td className="p-2.5 text-right">{row.heightOrDepthM.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-sky-800">{row.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="p-2.5 text-center font-semibold text-slate-600">{row.unit}</td>
                      <td className="p-2.5 text-right text-slate-600">₹{row.unitRateInr.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-800">₹{row.totalAmountInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-xs">
                    <td colSpan={10} className="p-3 text-right uppercase tracking-wider">
                      GRAND TOTAL ESTIMATED COST (CPWD / PWD DSR SCHEDULE):
                    </td>
                    <td className="p-3 text-right text-emerald-400 text-sm">
                      ₹{boqEstimate.grandTotalAmountInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Live Diameter-Wise Reinforcement Weight Schedule Table (kg & MT) */}
        <div className="bg-surface-card rounded-md border border-ui-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-400" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                DIAMETER-WISE REINFORCEMENT SCHEDULE IN KG &amp; METRIC TONNES (IS 2502 / SP:34)
              </h3>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono rounded font-bold">
              Bar Bending Schedule Matrix
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-ui-border font-bold">
                  <th className="p-3">STRUCTURAL COMPONENT</th>
                  <th className="p-3 text-right">8mm (kg)</th>
                  <th className="p-3 text-right">10mm (kg)</th>
                  <th className="p-3 text-right">12mm (kg)</th>
                  <th className="p-3 text-right">16mm (kg)</th>
                  <th className="p-3 text-right">20mm (kg)</th>
                  <th className="p-3 text-right">25mm (kg)</th>
                  <th className="p-3 text-right">32mm (kg)</th>
                  <th className="p-3 text-right text-secondary-brand">TOTAL (kg)</th>
                  <th className="p-3 text-right text-emerald-700">TOTAL (MT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border text-slate-700">
                {reportData.componentBreakdowns.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 hover:bg-slate-100/60'}>
                    <td className="p-3 font-bold text-slate-900">{row.component}</td>
                    <td className="p-3 text-right font-mono">{row.dia8Kg > 0 ? row.dia8Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia10Kg > 0 ? row.dia10Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia12Kg > 0 ? row.dia12Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia16Kg > 0 ? row.dia16Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia20Kg > 0 ? row.dia20Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia25Kg > 0 ? row.dia25Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono">{row.dia32Kg > 0 ? row.dia32Kg.toFixed(0) : '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-secondary-brand">{row.totalSteelKg.toFixed(0)} kg</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">{row.totalSteelMT.toFixed(2)} MT</td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="p-3 text-slate-950 font-extrabold uppercase">GRAND TOTAL REINFORCEMENT</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia8.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia10.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia12.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia16.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia20.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia25.toFixed(0)}</td>
                  <td className="p-3 text-right">{reportData.grandTotals.dia32.toFixed(0)}</td>
                  <td className="p-3 text-right text-secondary-brand text-sm">{reportData.grandTotals.grandTotalKg.toFixed(0)} kg</td>
                  <td className="p-3 text-right text-emerald-700 text-sm">{reportData.grandTotals.grandTotalMT.toFixed(2)} MT</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ARCHITECTURAL BIM QUANTITY TAKEOFF & MASONRY SUMMARY */}
        {Object.keys(architecturalWalls || {}).length > 0 && (
          <div className="bg-surface-card rounded-md border border-amber-300 shadow-sm overflow-hidden font-sans">
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border-b border-amber-800 flex items-center justify-between text-white flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <Calculator className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h3 className="font-mono text-sm font-bold text-amber-100">
                    ARCHITECTURAL BIM QUANTITY SURVEY &amp; MASONRY TAKEOFF
                  </h3>
                  <p className="text-[11px] text-amber-200 font-sans mt-0.5">
                    Parametric L × B × H wall volumes, opening deductions, plastering areas, and door/window schedules.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-amber-300">
                <span>Net Masonry: <strong>{archTakeoff.grandTotalNetMasonryM3} m³</strong></span>
                <span>•</span>
                <span>Plaster: <strong>{archTakeoff.grandTotalInternalPlasterM2} m²</strong></span>
                <span>•</span>
                <span>Carpet: <strong>{archTakeoff.grandTotalFloorAreaM2} m²</strong></span>
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-amber-50/80 text-amber-950 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">Story Name</th>
                    <th className="p-2.5">Elevation</th>
                    <th className="p-2.5 text-right">Net Masonry (m³)</th>
                    <th className="p-2.5 text-right">Gross Vol (m³)</th>
                    <th className="p-2.5 text-right">Int Plaster (m²)</th>
                    <th className="p-2.5 text-right">Ext Plaster (m²)</th>
                    <th className="p-2.5 text-center">Doors</th>
                    <th className="p-2.5 text-center">Windows</th>
                    <th className="p-2.5 text-right text-emerald-800">Carpet Area (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {archTakeoff.floorSummaries.map((f) => (
                    <tr key={f.floorId} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{f.floorName}</td>
                      <td className="p-2.5 text-slate-500">+{f.elevationY.toFixed(2)}m</td>
                      <td className="p-2.5 text-right font-bold text-amber-900">{f.totalNetMasonryM3.toFixed(3)}</td>
                      <td className="p-2.5 text-right text-slate-500">{f.totalGrossMasonryM3.toFixed(3)}</td>
                      <td className="p-2.5 text-right text-sky-800">{f.totalInternalPlasterM2.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-sky-900">{f.totalExternalPlasterM2.toFixed(2)}</td>
                      <td className="p-2.5 text-center font-bold">{f.totalDoorCount}</td>
                      <td className="p-2.5 text-center font-bold">{f.totalWindowCount}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-800">{f.totalFloorAreaM2.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONE-TAP STRUCTURAL DESIGN CALCULATION SHEETS */}
        <div className="bg-surface-card rounded-md border border-indigo-200 shadow-sm overflow-hidden font-sans">
          <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 border-b border-indigo-800 flex items-center justify-between text-white flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-mono text-sm font-bold text-indigo-50">
                  ONE-TAP STRUCTURAL DESIGN CALCULATION BOOKS (IS 456 / IS 13920 / IS 2911)
                </h3>
                <p className="text-[11px] text-indigo-200 font-sans mt-0.5">
                  Export complete step-by-step mathematical engineering calculation sheets with formulas, substitutions, and clause verifications.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadAllCalculationsPdf}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold rounded shadow transition-all shrink-0"
              title="1-Tap Export: All Columns, Beams, Piles & Pile Caps in a single master calculation book"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Download Master Calculation Book (All)</span>
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50">
            {/* Columns Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    RCC COLUMNS
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{reportData.columnsSummary.length} Members</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 mt-2 font-mono">IS 456 &amp; IS 13920 Columns</h4>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Biaxial interaction ratios, slenderness checks, Ast, and ductile confinement links.
                </p>
              </div>
              <button
                onClick={handleDownloadColumnsPdf}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-mono text-xs font-semibold shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Columns PDF
              </button>
            </div>

            {/* Beams Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    RCC BEAMS
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{reportData.beamsSummary.length} Members</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 mt-2 font-mono">IS 456 &amp; IS 13920 Beams</h4>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Support hogging &amp; midspan flexure, shear stress checks, and curtailment detailing.
                </p>
              </div>
              <button
                onClick={handleDownloadBeamsPdf}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 rounded font-mono text-xs font-semibold shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Beams PDF
              </button>
            </div>

            {/* Piles Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    RCC PILES
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{activeProject.projectPileTypes?.length || 1} Types</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 mt-2 font-mono">IS 2911:2010 Piles</h4>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Structural axial capacity (Pc), safe working load (Qsafe), group efficiency, and spirals.
                </p>
              </div>
              <button
                onClick={handleDownloadPilesPdf}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 rounded font-mono text-xs font-semibold shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Piles PDF
              </button>
            </div>

            {/* Pile Caps Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    PILE CAPS
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{activeModel.supports.size} Caps</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 mt-2 font-mono">IS 456 &amp; IS 2911 Caps</h4>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Two-way punching shear, single pile loads, flexural bottom mesh &amp; shrinkage grid.
                </p>
              </div>
              <button
                onClick={handleDownloadPileCapsPdf}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded font-mono text-xs font-semibold shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Pile Caps PDF
              </button>
            </div>
          </div>
        </div>

        {/* Report Content Sections Overview */}
        <div className="bg-surface-card rounded-md border border-ui-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-ui-border flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold text-deep-navy uppercase">
              A4 REPORT CHAPTERS &amp; DESIGN CALCULATION SECTIONS INCLUDED
            </h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono rounded font-bold">
              Complete 8-Page A4 PDF Suite
            </span>
          </div>

          <div className="divide-y divide-ui-border font-mono text-xs">
            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold">1</span>
                <div>
                  <span className="font-bold text-slate-800">Executive Summary &amp; Material Take-Off (BOQ)</span>
                  <p className="text-[11px] text-slate-500 font-sans">Concrete volumes for every structure part, steel tonnage, design parameters, and intensity</p>
                </div>
              </div>
              <span className="text-slate-400">Page 1</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50 bg-amber-50/40">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center font-bold">2</span>
                <div>
                  <span className="font-bold text-amber-950">Diameter-Wise Reinforcement Matrix (8, 10, 12, 16, 20, 25, 32mm in kg)</span>
                  <p className="text-[11px] text-slate-600 font-sans">Full Bar Bending Schedule (BBS) take-off breakdown per component in kg and MT</p>
                </div>
              </div>
              <span className="text-amber-700 font-bold">Page 2 (BBS)</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50 bg-sky-50/40">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-sky-600 text-white flex items-center justify-center font-bold">3</span>
                <div>
                  <span className="font-bold text-sky-950">2D Structural Layout Plan (Denoting Every Detail)</span>
                  <p className="text-[11px] text-slate-600 font-sans">High-resolution vector plan with grid axes, column IDs (C1..C24), pile caps, combined shear wall mats, and grade beams</p>
                </div>
              </div>
              <span className="text-sky-700 font-bold">Page 3 (2D Plan)</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">4</span>
                <div>
                  <span className="font-bold text-slate-800">2D Typical Floor Framing &amp; Beam Layout Plan</span>
                  <p className="text-[11px] text-slate-500 font-sans">Elevated beam spans, member tags (B1..B60), column sections, and slab panel areas</p>
                </div>
              </div>
              <span className="text-slate-400">Page 4</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">5</span>
                <div>
                  <span className="font-bold text-slate-800">RCC Column Design Calculations ({reportData.columnsSummary.length} Columns)</span>
                  <p className="text-[11px] text-slate-500 font-sans">Axial load Pu, biaxial moments Mux/Muy, Bresler interaction ratio (IR &le; 0.85), longitudinal steel, and IS 13920 ductile links</p>
                </div>
              </div>
              <span className="text-slate-400">Page 5</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">6</span>
                <div>
                  <span className="font-bold text-slate-800">RCC Beam Design Calculations ({reportData.beamsSummary.length} Beams)</span>
                  <p className="text-[11px] text-slate-500 font-sans">Sagging &amp; hogging flexure, shear capacity, longitudinal continuous rebars, and 2-legged shear confinement stirrups</p>
                </div>
              </div>
              <span className="text-slate-400">Page 6</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold">7</span>
                <div>
                  <span className="font-bold text-slate-800">Ductile RC Shear Wall Design &amp; Boundary Detailing</span>
                  <p className="text-[11px] text-slate-500 font-sans">Minimum 200mm thickness, nominal shear stress tau_v, boundary element longitudinal steel (8-T20), confining hoops, and web double curtain</p>
                </div>
              </div>
              <span className="text-slate-400">Page 7</span>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold">8</span>
                <div>
                  <span className="font-bold text-slate-800">Foundation Pile Caps, Combined Mats &amp; Grade Beams (Qsafe = 280 kN)</span>
                  <p className="text-[11px] text-slate-500 font-sans">Single pile capacity verification, 2-way column punching shear, bottom flexural mesh, top grid, and grade beam strap ties</p>
                </div>
              </div>
              <span className="text-slate-400">Page 8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
