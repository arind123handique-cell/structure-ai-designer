/**
 * Live Architectural BIM Quantity Takeoff and Material Survey Panel
 * Displays exact L × B × H calculations, opening deductions, schedules, and floor summaries.
 */

import React, { useState, useMemo } from 'react';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  BuildingArchitecturalTakeoff,
} from '../types/architecturalTypes';
import { ArchitecturalTakeoffEngine } from '../engines/architecturalTakeoffEngine';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import {
  Calculator,
  Download,
  FileSpreadsheet,
  Layers,
  DoorOpen,
  AppWindow,
  Square,
  Tag,
  CheckCircle2,
  ChevronDown,
  Table,
} from 'lucide-react';

interface ArchitecturalTakeoffPanelProps {
  walls: Record<string, ArchitecturalWall>;
  doors: Record<string, ArchitecturalDoor>;
  windows: Record<string, ArchitecturalWindow>;
  openings: Record<string, ArchitecturalOpening>;
  rooms: Record<string, ArchitecturalRoom>;
  floorPlans: FloorPlanLevel[];
  activeFloorIndex: number;
}

export const ArchitecturalTakeoffPanel: React.FC<ArchitecturalTakeoffPanelProps> = ({
  walls,
  doors,
  windows,
  openings,
  rooms,
  floorPlans,
  activeFloorIndex,
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'WALLS' | 'DOORS' | 'WINDOWS' | 'ROOMS'>('SUMMARY');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');

  const takeoff: BuildingArchitecturalTakeoff = useMemo(() => {
    return ArchitecturalTakeoffEngine.calculateBuildingTakeoff(
      walls,
      doors,
      windows,
      openings,
      rooms,
      floorPlans
    );
  }, [walls, doors, windows, openings, rooms, floorPlans]);

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'ARCHITECTURAL BIM QUANTITY TAKEOFF REPORT\n';
    csv += `Generated: ${new Date().toISOString()}\n\n`;

    csv += '--- GRAND SUMMARY ---\n';
    csv += `Total Net Masonry Volume (m3),${takeoff.grandTotalNetMasonryM3}\n`;
    csv += `Total Gross Masonry Volume (m3),${takeoff.grandTotalGrossMasonryM3}\n`;
    csv += `Total Internal Plaster Area (m2),${takeoff.grandTotalInternalPlasterM2}\n`;
    csv += `Total External Plaster Area (m2),${takeoff.grandTotalExternalPlasterM2}\n`;
    csv += `Total Doors Count,${takeoff.grandTotalDoors}\n`;
    csv += `Total Windows Count,${takeoff.grandTotalWindows}\n`;
    csv += `Total Floor Carpet Area (m2),${takeoff.grandTotalFloorAreaM2}\n\n`;

    csv += '--- WALL MASONRY SCHEDULE ---\n';
    csv += 'Wall ID,Floor,Type,Length (m),Thickness (m),Height (m),Gross Vol (m3),Deductions (m3),Net Vol (m3),Int Plaster (m2),Ext Plaster (m2)\n';

    takeoff.floorSummaries.forEach((f) => {
      f.walls.forEach((w) => {
        csv += `${w.wallId},${f.floorName},${w.wallType},${w.length},${w.thickness},${w.height},${w.grossVolume},${w.totalOpeningVolume},${w.netMasonryVolume},${w.internalPlasterArea},${w.externalPlasterArea}\n`;
      });
    });

    csv += '\n--- DOOR SCHEDULE ---\n';
    csv += 'Door ID,Floor,Type,Width (mm),Height (mm),Area (m2),Quantity\n';
    takeoff.floorSummaries.forEach((f) => {
      f.doors.forEach((d) => {
        csv += `${d.doorId},${f.floorName},${d.type},${d.width},${d.height},${d.area},${d.quantity}\n`;
      });
    });

    csv += '\n--- WINDOW SCHEDULE ---\n';
    csv += 'Window ID,Floor,Type,Width (mm),Height (mm),Sill Height (mm),Area (m2),Quantity\n';
    takeoff.floorSummaries.forEach((f) => {
      f.windows.forEach((win) => {
        csv += `${win.windowId},${f.floorName},${win.type},${win.width},${win.height},${win.sillHeight},${win.area},${win.quantity}\n`;
      });
    });

    csv += '\n--- ROOM CARPET AREA SCHEDULE ---\n';
    csv += 'Room ID,Floor,Name,Type,Carpet Area (m2),Perimeter (m)\n';
    takeoff.floorSummaries.forEach((f) => {
      f.rooms.forEach((r) => {
        csv += `${r.id},${f.floorName},${r.name},${r.roomType},${r.area},${r.perimeter}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Architectural_Takeoff_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFloors = floorFilter === 'ALL'
    ? takeoff.floorSummaries
    : takeoff.floorSummaries.filter((f) => f.floorId === floorFilter);

  return (
    <div className="flex-1 bg-slate-950 flex flex-col font-mono text-xs text-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Architectural BIM Takeoff & Cost Estimation</h2>
            <span className="text-[11px] text-slate-400">
              Live mathematical L × B × H takeoff with exact opening deductions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Floor Filter */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] text-slate-400">Filter:</span>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Stories</option>
              {takeoff.floorSummaries.map((f) => (
                <option key={f.floorId} value={f.floorId}>
                  {f.floorName}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 bg-slate-900/60 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('SUMMARY')}
          className={`px-3 py-1.5 rounded-t-lg font-bold transition-colors border-t border-x ${
            activeTab === 'SUMMARY'
              ? 'bg-slate-950 text-emerald-400 border-slate-700'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          Grand Summary
        </button>
        <button
          onClick={() => setActiveTab('WALLS')}
          className={`px-3 py-1.5 rounded-t-lg font-bold transition-colors border-t border-x ${
            activeTab === 'WALLS'
              ? 'bg-slate-950 text-amber-400 border-slate-700'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          Wall Masonry ({Object.keys(walls).length})
        </button>
        <button
          onClick={() => setActiveTab('DOORS')}
          className={`px-3 py-1.5 rounded-t-lg font-bold transition-colors border-t border-x ${
            activeTab === 'DOORS'
              ? 'bg-slate-950 text-amber-300 border-slate-700'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          Door Schedule ({Object.keys(doors).length})
        </button>
        <button
          onClick={() => setActiveTab('WINDOWS')}
          className={`px-3 py-1.5 rounded-t-lg font-bold transition-colors border-t border-x ${
            activeTab === 'WINDOWS'
              ? 'bg-slate-950 text-sky-400 border-slate-700'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          Window Schedule ({Object.keys(windows).length})
        </button>
        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`px-3 py-1.5 rounded-t-lg font-bold transition-colors border-t border-x ${
            activeTab === 'ROOMS'
              ? 'bg-slate-950 text-emerald-400 border-slate-700'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          Room Carpet Area ({Object.keys(rooms).length})
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* 1. GRAND SUMMARY TAB */}
        {activeTab === 'SUMMARY' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3.5">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Total Net Masonry</span>
                <div className="text-xl font-bold text-amber-400">{takeoff.grandTotalNetMasonryM3} m³</div>
                <span className="text-[10px] text-slate-500">Gross: {takeoff.grandTotalGrossMasonryM3} m³</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Total Internal Plaster</span>
                <div className="text-xl font-bold text-sky-400">{takeoff.grandTotalInternalPlasterM2} m²</div>
                <span className="text-[10px] text-slate-500">External: {takeoff.grandTotalExternalPlasterM2} m²</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Doors & Windows</span>
                <div className="text-xl font-bold text-white">
                  {takeoff.grandTotalDoors} Doors • {takeoff.grandTotalWindows} Wins
                </div>
                <span className="text-[10px] text-slate-500">Total openings: {takeoff.grandTotalDoors + takeoff.grandTotalWindows + takeoff.grandTotalOpenings}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Total Carpet Area</span>
                <div className="text-xl font-bold text-emerald-400">{takeoff.grandTotalFloorAreaM2} m²</div>
                <span className="text-[10px] text-slate-500">{Object.keys(rooms).length} enclosed rooms</span>
              </div>
            </div>

            {/* Floor Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-850 font-bold text-white flex items-center justify-between">
                <span>Story-by-Story Takeoff Breakdown</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Story Name</th>
                      <th className="p-3">Elevation</th>
                      <th className="p-3 text-right">Net Masonry (m³)</th>
                      <th className="p-3 text-right">Int Plaster (m²)</th>
                      <th className="p-3 text-right">Ext Plaster (m²)</th>
                      <th className="p-3 text-center">Doors</th>
                      <th className="p-3 text-center">Windows</th>
                      <th className="p-3 text-right">Carpet Area (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {takeoff.floorSummaries.map((f) => (
                      <tr key={f.floorId} className="hover:bg-slate-850/60">
                        <td className="p-3 font-bold text-white">{f.floorName}</td>
                        <td className="p-3 text-slate-400">+{f.elevationY.toFixed(2)}m</td>
                        <td className="p-3 text-right font-bold text-amber-400">{f.totalNetMasonryM3.toFixed(3)}</td>
                        <td className="p-3 text-right text-sky-300">{f.totalInternalPlasterM2.toFixed(2)}</td>
                        <td className="p-3 text-right text-sky-400">{f.totalExternalPlasterM2.toFixed(2)}</td>
                        <td className="p-3 text-center">{f.totalDoorCount}</td>
                        <td className="p-3 text-center">{f.totalWindowCount}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{f.totalFloorAreaM2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-800/90 font-bold text-white border-t border-slate-700">
                    <tr>
                      <td className="p-3">GRAND TOTAL</td>
                      <td className="p-3">-</td>
                      <td className="p-3 text-right text-amber-400">{takeoff.grandTotalNetMasonryM3}</td>
                      <td className="p-3 text-right text-sky-300">{takeoff.grandTotalInternalPlasterM2}</td>
                      <td className="p-3 text-right text-sky-400">{takeoff.grandTotalExternalPlasterM2}</td>
                      <td className="p-3 text-center">{takeoff.grandTotalDoors}</td>
                      <td className="p-3 text-center">{takeoff.grandTotalWindows}</td>
                      <td className="p-3 text-right text-emerald-400">{takeoff.grandTotalFloorAreaM2}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. WALL MASONRY TAB */}
        {activeTab === 'WALLS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Wall ID</th>
                    <th className="p-2.5">Story</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">L (m)</th>
                    <th className="p-2.5 text-right">B (m)</th>
                    <th className="p-2.5 text-right">H (m)</th>
                    <th className="p-2.5 text-right">Gross (m³)</th>
                    <th className="p-2.5 text-right">Deductions (m³)</th>
                    <th className="p-2.5 text-right text-amber-400">Net Vol (m³)</th>
                    <th className="p-2.5 text-right text-sky-300">Int Plaster (m²)</th>
                    <th className="p-2.5 text-right text-sky-400">Ext Plaster (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredFloors.flatMap((f) =>
                    f.walls.map((w) => (
                      <tr key={w.wallId} className="hover:bg-slate-850">
                        <td className="p-2.5 font-bold text-white">{w.wallId}</td>
                        <td className="p-2.5 text-slate-400">{f.floorName}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            w.wallType === 'EXTERNAL' ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {w.wallType}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">{w.length.toFixed(2)}</td>
                        <td className="p-2.5 text-right">{w.thickness.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{w.height.toFixed(2)}</td>
                        <td className="p-2.5 text-right">{w.grossVolume.toFixed(3)}</td>
                        <td className="p-2.5 text-right text-red-400">
                          {w.totalOpeningVolume > 0 ? `-${w.totalOpeningVolume.toFixed(3)}` : '0.000'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-400">{w.netMasonryVolume.toFixed(3)}</td>
                        <td className="p-2.5 text-right text-sky-300">{w.internalPlasterArea.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-sky-400">{w.externalPlasterArea.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. DOOR SCHEDULE TAB */}
        {activeTab === 'DOORS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Door ID</th>
                    <th className="p-3">Story</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Width (mm)</th>
                    <th className="p-3 text-right">Height (mm)</th>
                    <th className="p-3 text-right">Area (m²)</th>
                    <th className="p-3 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredFloors.flatMap((f) =>
                    f.doors.map((d) => (
                      <tr key={d.doorId} className="hover:bg-slate-850">
                        <td className="p-3 font-bold text-amber-400">{d.doorId}</td>
                        <td className="p-3 text-slate-400">{f.floorName}</td>
                        <td className="p-3">{d.type}</td>
                        <td className="p-3 text-right font-bold text-white">{d.width}</td>
                        <td className="p-3 text-right font-bold text-white">{d.height}</td>
                        <td className="p-3 text-right">{d.area.toFixed(2)}</td>
                        <td className="p-3 text-center font-bold">1</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. WINDOW SCHEDULE TAB */}
        {activeTab === 'WINDOWS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Window ID</th>
                    <th className="p-3">Story</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Width (mm)</th>
                    <th className="p-3 text-right">Height (mm)</th>
                    <th className="p-3 text-right">Sill (mm)</th>
                    <th className="p-3 text-right">Area (m²)</th>
                    <th className="p-3 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredFloors.flatMap((f) =>
                    f.windows.map((w) => (
                      <tr key={w.windowId} className="hover:bg-slate-850">
                        <td className="p-3 font-bold text-sky-400">{w.windowId}</td>
                        <td className="p-3 text-slate-400">{f.floorName}</td>
                        <td className="p-3">{w.type}</td>
                        <td className="p-3 text-right font-bold text-white">{w.width}</td>
                        <td className="p-3 text-right font-bold text-white">{w.height}</td>
                        <td className="p-3 text-right text-slate-400">{w.sillHeight}</td>
                        <td className="p-3 text-right">{w.area.toFixed(2)}</td>
                        <td className="p-3 text-center font-bold">1</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. ROOM CARPET AREA TAB */}
        {activeTab === 'ROOMS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Room ID</th>
                    <th className="p-3">Story</th>
                    <th className="p-3">Room Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right text-emerald-400">Carpet Area (m²)</th>
                    <th className="p-3 text-right">Perimeter (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredFloors.flatMap((f) =>
                    f.rooms.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-850">
                        <td className="p-3 font-bold text-emerald-400">{r.id}</td>
                        <td className="p-3 text-slate-400">{f.floorName}</td>
                        <td className="p-3 font-bold text-white">{r.name}</td>
                        <td className="p-3">{r.roomType}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{r.area.toFixed(2)}</td>
                        <td className="p-3 text-right">{r.perimeter.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
