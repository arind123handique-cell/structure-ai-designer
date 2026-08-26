import React, { useMemo, useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { exportToCsv } from '@/utils/exportUtils';
import {
  Building,
  Ruler,
  Maximize2,
  Layers,
  FileSpreadsheet,
  Copy,
  Check,
  Download,
  Info,
  TrendingUp,
  Grid,
  Box,
  Compass,
} from 'lucide-react';

export const BuildingDetailsPanel: React.FC = () => {
  const { activeModel, activeProject } = useProjectStore();
  const [copied, setCopied] = useState(false);

  // Extract Floor Level Plans & Geometry metrics
  const floorPlans = useMemo(() => {
    if (!activeModel) return [];
    return FloorPlanEngine.extractAllFloorPlans(activeModel);
  }, [activeModel]);

  // Compute Floor-by-Floor Centerline & Estimation Data
  const floorCenterlineData = useMemo(() => {
    if (floorPlans.length === 0) return [];

    return floorPlans.map((fp) => {
      const isFoundation = fp.isFoundationLevel;
      const beamCenterlineM = fp.beams.reduce((sum, b) => sum + (b.length || 0), 0);
      const gridWidth = fp.bounds.width || 12;
      const gridHeight = fp.bounds.height || 16;
      const gridPerimeterM = 2 * (gridWidth + gridHeight);

      // Estimate wall centerline length based on beam centerline and grid layout
      const wallCenterlineM = isFoundation
        ? fp.gradeBeams.reduce((sum, gb) => sum + (gb.length || 0), 0) || gridPerimeterM
        : beamCenterlineM > 0
        ? beamCenterlineM
        : gridPerimeterM * 1.5;

      const totalCenterlineM = Math.max(beamCenterlineM, wallCenterlineM);
      const areaM2 = fp.metrics.totalFloorAreaM2 || gridWidth * gridHeight;
      const areaSqFt = Math.round(areaM2 * 10.7639);

      // Quantity Estimation Metrics per floor
      const storyHeight = 3.2; // m
      const netWallHeight = Math.max(2.4, storyHeight - 0.45);
      const masonryVolM3 = Number((wallCenterlineM * netWallHeight * 0.23).toFixed(2));
      const plasteringAreaM2 = Number((2 * wallCenterlineM * netWallHeight).toFixed(2));
      const formworkAreaM2 = Number((areaM2 + 2 * beamCenterlineM * 0.45).toFixed(2));

      return {
        levelIndex: fp.levelIndex,
        levelName: fp.levelName,
        elevationY: fp.elevationY,
        isFoundation,
        beamCount: fp.metrics.totalBeams,
        colCount: fp.metrics.totalColumns,
        slabCount: fp.metrics.totalSlabs,
        beamCenterlineM: Number(beamCenterlineM.toFixed(2)),
        wallCenterlineM: Number(wallCenterlineM.toFixed(2)),
        gridPerimeterM: Number(gridPerimeterM.toFixed(2)),
        totalCenterlineM: Number(totalCenterlineM.toFixed(2)),
        areaM2: Number(areaM2.toFixed(2)),
        areaSqFt,
        concreteM3: Number(fp.metrics.totalConcreteM3.toFixed(2)),
        steelKg: Number(fp.metrics.totalSteelKg.toFixed(2)),
        masonryVolM3,
        plasteringAreaM2,
        formworkAreaM2,
      };
    });
  }, [floorPlans]);

  // Overall Building Summary Metrics
  const buildingSummary = useMemo(() => {
    if (floorCenterlineData.length === 0) {
      return {
        totalFloors: 0,
        buildingHeightM: 0,
        totalBuiltUpM2: 0,
        totalBuiltUpSqFt: 0,
        totalCenterlineM: 0,
        totalConcreteM3: 0,
        totalSteelKg: 0,
        totalSteelMT: 0,
        totalMasonryM3: 0,
        totalPlasteringM2: 0,
        totalFormworkM2: 0,
        totalColumns: 0,
        totalBeams: 0,
        totalSlabs: 0,
      };
    }

    const elevatedFloors = floorCenterlineData.filter((f) => !f.isFoundation);
    const totalFloors = elevatedFloors.length;
    const minY = Math.min(...floorCenterlineData.map((f) => f.elevationY));
    const maxY = Math.max(...floorCenterlineData.map((f) => f.elevationY));
    const buildingHeightM = Number((maxY - minY).toFixed(2));

    const totalBuiltUpM2 = elevatedFloors.reduce((sum, f) => sum + f.areaM2, 0);
    const totalBuiltUpSqFt = Math.round(totalBuiltUpM2 * 10.7639);
    const totalCenterlineM = Number(floorCenterlineData.reduce((sum, f) => sum + f.totalCenterlineM, 0).toFixed(2));

    const totalConcreteM3 = Number(floorCenterlineData.reduce((sum, f) => sum + f.concreteM3, 0).toFixed(2));
    const totalSteelKg = Number(floorCenterlineData.reduce((sum, f) => sum + f.steelKg, 0).toFixed(2));
    const totalSteelMT = Number((totalSteelKg / 1000).toFixed(2));
    const totalMasonryM3 = Number(floorCenterlineData.reduce((sum, f) => sum + f.masonryVolM3, 0).toFixed(2));
    const totalPlasteringM2 = Number(floorCenterlineData.reduce((sum, f) => sum + f.plasteringAreaM2, 0).toFixed(2));
    const totalFormworkM2 = Number(floorCenterlineData.reduce((sum, f) => sum + f.formworkAreaM2, 0).toFixed(2));

    const totalColumns = activeModel?.members
      ? Array.from(activeModel.members.values()).filter((m: any) => m.classification === 'COLUMN').length
      : 0;
    const totalBeams = activeModel?.members
      ? Array.from(activeModel.members.values()).filter((m: any) => m.classification === 'BEAM').length
      : 0;
    const totalSlabs = activeModel?.plates
      ? Array.from(activeModel.plates.values()).filter((p: any) => p.classification === 'SLAB').length
      : 0;

    return {
      totalFloors,
      buildingHeightM,
      totalBuiltUpM2: Number(totalBuiltUpM2.toFixed(2)),
      totalBuiltUpSqFt,
      totalCenterlineM,
      totalConcreteM3,
      totalSteelKg,
      totalSteelMT,
      totalMasonryM3,
      totalPlasteringM2,
      totalFormworkM2,
      totalColumns,
      totalBeams,
      totalSlabs,
    };
  }, [floorCenterlineData, activeModel]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (floorCenterlineData.length === 0) return;
    const exportRows = floorCenterlineData.map((f) => ({
      'Floor Level': f.levelName,
      'Elevation (m)': f.elevationY,
      'Beam Centerline (m)': f.beamCenterlineM,
      'Wall Centerline (m)': f.wallCenterlineM,
      'Grid Perimeter (m)': f.gridPerimeterM,
      'Total Centerline (m)': f.totalCenterlineM,
      'Floor Area (m²)': f.areaM2,
      'Floor Area (sq.ft)': f.areaSqFt,
      'Concrete Vol (m³)': f.concreteM3,
      'Steel Rebar (kg)': f.steelKg,
      'Masonry Brickwork (m³)': f.masonryVolM3,
      'Plaster Area (m²)': f.plasteringAreaM2,
      'Shuttering Formwork (m²)': f.formworkAreaM2,
    }));

    const projName = activeProject?.metadata?.name || 'Building_Project';
    exportToCsv(exportRows, `${projName}_Building_Details_Centerline_Estimation.csv`);
  };

  // Copy Centerline Summary to Clipboard
  const handleCopySummary = () => {
    let summaryText = `BUILDING DETAILS & CENTERLINE ESTIMATION SUMMARY\n`;
    summaryText += `===================================================\n`;
    summaryText += `Project Name: ${activeProject?.metadata?.name || 'STAAD Building'}\n`;
    summaryText += `Total Storeys: ${buildingSummary.totalFloors} Floors\n`;
    summaryText += `Building Height: ${buildingSummary.buildingHeightM} m\n`;
    summaryText += `Total Built-Up Area: ${buildingSummary.totalBuiltUpM2} m² (${buildingSummary.totalBuiltUpSqFt} sq.ft)\n`;
    summaryText += `Total Building Centerline: ${buildingSummary.totalCenterlineM} m\n`;
    summaryText += `Total Concrete Volume: ${buildingSummary.totalConcreteM3} m³\n`;
    summaryText += `Total Steel Reinforcement: ${buildingSummary.totalSteelMT} MT (${buildingSummary.totalSteelKg} kg)\n\n`;
    summaryText += `FLOOR-BY-FLOOR CENTERLINE BREAKDOWN:\n`;
    summaryText += `---------------------------------------------------\n`;

    floorCenterlineData.forEach((f) => {
      summaryText += `${f.levelName} (EL. ${f.elevationY}m):\n`;
      summaryText += `  - Beam Centerline: ${f.beamCenterlineM} m\n`;
      summaryText += `  - Wall Centerline: ${f.wallCenterlineM} m\n`;
      summaryText += `  - Total Floor Centerline: ${f.totalCenterlineM} m\n`;
      summaryText += `  - Floor Area: ${f.areaM2} m² (${f.areaSqFt} sq.ft)\n`;
      summaryText += `  - Concrete: ${f.concreteM3} m³ | Steel: ${f.steelKg} kg\n\n`;
    });

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active structural model loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-mono p-4 space-y-4 overflow-y-auto select-none">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950 rounded-lg border border-indigo-800 text-indigo-400">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              BUILDING DETAILS &amp; TOTAL CENTERLINE ESTIMATION PANEL
            </h2>
            <p className="text-xs text-slate-400">
              Floor-by-Floor Centerline Lengths, Built-Up Areas &amp; Architectural Quantity Survey Takeoff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold transition-all border border-slate-700 shadow"
            title="Copy Building Details & Centerline Summary to Clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow transition-all"
            title="Export Building Estimation & Centerline data to CSV file"
          >
            <Download className="w-4 h-4" />
            <span>Export Estimation CSV</span>
          </button>
        </div>
      </div>

      {/* Hero Estimation Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>TOTAL STOREYS</span>
            <Building className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-white">{buildingSummary.totalFloors} Floors</div>
            <div className="text-[10px] text-slate-500">Height: {buildingSummary.buildingHeightM}m</div>
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>TOTAL BUILT-UP AREA</span>
            <Maximize2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-sky-400">{buildingSummary.totalBuiltUpM2} m²</div>
            <div className="text-[10px] text-slate-400">{buildingSummary.totalBuiltUpSqFt.toLocaleString()} sq.ft</div>
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-indigo-900/60 bg-indigo-950/20 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-indigo-300 text-[11px]">
            <span>TOTAL CENTERLINE</span>
            <Ruler className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-indigo-300">{buildingSummary.totalCenterlineM} m</div>
            <div className="text-[10px] text-indigo-400">All Floor Beams &amp; Walls</div>
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>CONCRETE VOLUME</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-300">{buildingSummary.totalConcreteM3} m³</div>
            <div className="text-[10px] text-slate-500">Cols, Beams, Slabs, Caps</div>
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>STEEL REBAR TAKEOFF</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-emerald-400">{buildingSummary.totalSteelMT} MT</div>
            <div className="text-[10px] text-slate-400">{buildingSummary.totalSteelKg.toLocaleString()} kg</div>
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>BRICKWORK &amp; PLASTER</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-purple-300">{buildingSummary.totalMasonryM3} m³</div>
            <div className="text-[10px] text-purple-400">Plaster: {buildingSummary.totalPlasteringM2} m²</div>
          </div>
        </div>
      </div>

      {/* Main Floor-by-Floor Centerline Breakdown Table */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Ruler className="w-4 h-4 text-indigo-400" />
            PER-FLOOR CENTERLINE &amp; GEOMETRY BREAKDOWN TABLE
          </h3>
          <span className="text-xs text-slate-400">
            Total Levels Evaluated: {floorCenterlineData.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Floor Elevation Level</th>
                <th className="py-2.5 px-3">Elevation Y</th>
                <th className="py-2.5 px-3 text-right">Beam Centerline</th>
                <th className="py-2.5 px-3 text-right">Wall Centerline</th>
                <th className="py-2.5 px-3 text-right">Grid Perimeter</th>
                <th className="py-2.5 px-3 text-right text-indigo-300">Total Floor Centerline</th>
                <th className="py-2.5 px-3 text-right">Floor Area (m²)</th>
                <th className="py-2.5 px-3 text-right">Floor Area (sq.ft)</th>
                <th className="py-2.5 px-3 text-right">Concrete (m³)</th>
                <th className="py-2.5 px-3 text-right">Steel (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {floorCenterlineData.map((f, idx) => (
                <tr
                  key={`floor_cl_row_${idx}`}
                  className="hover:bg-slate-800/60 transition-colors"
                >
                  <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    {f.levelName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">EL. +{f.elevationY.toFixed(2)} m</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                    {f.beamCenterlineM} m
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {f.wallCenterlineM} m
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {f.gridPerimeterM} m
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-indigo-300 bg-indigo-950/20">
                    {f.totalCenterlineM} m
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-sky-300">
                    {f.areaM2} m²
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {f.areaSqFt.toLocaleString()} sq.ft
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-300">
                    {f.concreteM3} m³
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                    {f.steelKg.toLocaleString()} kg
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 font-bold text-white border-t border-slate-700 text-xs">
                <td className="py-3 px-3">GRAND TOTAL (ALL FLOORS)</td>
                <td className="py-3 px-3 text-slate-400">{buildingSummary.buildingHeightM} m Height</td>
                <td className="py-3 px-3 text-right text-slate-200">
                  {floorCenterlineData.reduce((sum, f) => sum + f.beamCenterlineM, 0).toFixed(2)} m
                </td>
                <td className="py-3 px-3 text-right text-slate-300">
                  {floorCenterlineData.reduce((sum, f) => sum + f.wallCenterlineM, 0).toFixed(2)} m
                </td>
                <td className="py-3 px-3 text-right text-slate-400">-</td>
                <td className="py-3 px-3 text-right text-indigo-300 bg-indigo-950/40 text-sm">
                  {buildingSummary.totalCenterlineM} m
                </td>
                <td className="py-3 px-3 text-right text-sky-300 text-sm">
                  {buildingSummary.totalBuiltUpM2} m²
                </td>
                <td className="py-3 px-3 text-right text-slate-300">
                  {buildingSummary.totalBuiltUpSqFt.toLocaleString()} sq.ft
                </td>
                <td className="py-3 px-3 text-right text-amber-300">
                  {buildingSummary.totalConcreteM3} m³
                </td>
                <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                  {buildingSummary.totalSteelMT} MT ({buildingSummary.totalSteelKg.toLocaleString()} kg)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Secondary Detailed Estimation Component Matrix Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Architectural Quantity Survey Estimates */}
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            BUILDING ARCHITECTURAL ESTIMATION &amp; MASONRY TAKEOFF
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">230mm Exterior Wall Brickwork Volume:</span>
              <span className="text-purple-300 font-bold">
                {(buildingSummary.totalMasonryM3 * 0.65).toFixed(2)} m³
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">115mm Interior Partition Brickwork Volume:</span>
              <span className="text-purple-300 font-bold">
                {(buildingSummary.totalMasonryM3 * 0.35).toFixed(2)} m³
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Internal &amp; External Wall Plastering:</span>
              <span className="text-purple-300 font-bold">{buildingSummary.totalPlasteringM2} m²</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Centering &amp; Shuttering Formwork:</span>
              <span className="text-purple-300 font-bold">{buildingSummary.totalFormworkM2} m²</span>
            </div>
          </div>
        </div>

        {/* Structural Component Element Counts */}
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            STRUCTURAL ELEMENT INVENTORY &amp; FRAME METRICS
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Columns Designed:</span>
              <span className="text-emerald-400 font-bold">{buildingSummary.totalColumns} Members</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Beams Framing:</span>
              <span className="text-emerald-400 font-bold">{buildingSummary.totalBeams} Members</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Floor Slab Panels:</span>
              <span className="text-emerald-400 font-bold">{buildingSummary.totalSlabs} Panels</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-300 font-bold">Total Ground Support Footings / Caps:</span>
              <span className="text-emerald-400 font-bold">
                {activeModel.supports ? activeModel.supports.size : 0} Support Joints
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
