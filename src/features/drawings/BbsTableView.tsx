import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { BbsEngine, BbsItem, BbsProjectOutput } from '@/features/calculations/bbsEngine';
import { BbsShapeSvg } from './BbsShapeSvg';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Layers,
  Box,
  Compass,
  Building,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderMinus,
  ListTree,
  Grid,
} from 'lucide-react';

export interface BbsGroup {
  tag: string;
  category: string;
  items: BbsItem[];
  totalLengthM: number;
  totalWeightKg: number;
  lengthByDia: { [dia: number]: number };
}

export const BbsTableView: React.FC = () => {
  const { activeProject, activeModel } = useProjectStore();
  const [unit, setUnit] = useState<'mm' | 'm'>('m');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'MEMBER' | 'CATEGORY' | 'FLAT'>('MEMBER');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const bbsData: BbsProjectOutput = useMemo(() => {
    return BbsEngine.generateBuildingBbs(activeModel, activeProject);
  }, [activeModel, activeProject]);

  const filteredItems = useMemo(() => {
    return bbsData.items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.elementCategory !== categoryFilter) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        return (
          item.elementTag.toLowerCase().includes(term) ||
          item.barDescription.toLowerCase().includes(term) ||
          item.diameter.toString().includes(term) ||
          item.barNo.toString().includes(term)
        );
      }
      return true;
    });
  }, [bbsData.items, categoryFilter, searchTerm]);

  // Group-Wise Hierarchy Construction
  const groups: BbsGroup[] = useMemo(() => {
    if (groupBy === 'FLAT') {
      const unitWt = (item: BbsItem) => (item.diameter * item.diameter) / 162.2;
      return [
        {
          tag: 'ALL BAR ITEMS',
          category: categoryFilter,
          items: filteredItems,
          totalLengthM: filteredItems.reduce((s, i) => s + i.totalLengthM, 0),
          totalWeightKg: filteredItems.reduce((s, i) => s + i.totalLengthM * unitWt(i), 0),
          lengthByDia: filteredItems.reduce((acc, i) => {
            acc[i.diameter] = (acc[i.diameter] || 0) + i.totalLengthM;
            return acc;
          }, {} as { [dia: number]: number }),
        },
      ];
    }

    const map = new Map<string, BbsGroup>();

    filteredItems.forEach((item) => {
      let key = item.elementTag;
      if (groupBy === 'CATEGORY') {
        key =
          item.elementCategory === 'PILE_CAP'
            ? 'PILE CAPS & FOUNDATIONS'
            : item.elementCategory === 'COLUMN'
            ? 'COLUMNS & STARTER DOWELS'
            : item.elementCategory === 'BEAM'
            ? 'BEAMS & FRAMING'
            : item.elementCategory === 'GRADE_BEAM'
            ? 'GRADE TIE BEAMS'
            : item.elementCategory === 'STAIRCASE'
            ? 'STAIRCASES & WAIST FLIGHTS'
            : item.elementCategory === 'SLAB'
            ? 'FLOOR SLABS'
            : item.elementCategory === 'SHEAR_WALL'
            ? 'SHEAR WALLS'
            : item.elementCategory;
      }

      if (!map.has(key)) {
        map.set(key, {
          tag: key,
          category: item.elementCategory,
          items: [],
          totalLengthM: 0,
          totalWeightKg: 0,
          lengthByDia: {},
        });
      }

      const grp = map.get(key)!;
      grp.items.push(item);
      grp.totalLengthM += item.totalLengthM;
      const unitWt = (item.diameter * item.diameter) / 162.2;
      const wtKg = item.totalLengthM * unitWt;
      grp.totalWeightKg += wtKg;
      grp.lengthByDia[item.diameter] = (grp.lengthByDia[item.diameter] || 0) + item.totalLengthM;
    });

    return Array.from(map.values());
  }, [filteredItems, groupBy, categoryFilter]);

  const toggleGroup = (tag: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedGroups(new Set());
  const handleCollapseAll = () => setCollapsedGroups(new Set(groups.map((g) => g.tag)));

  // Recalculate summary totals for filtered items
  const filteredDiameterTotals = useMemo(() => {
    const totals: { [dia: number]: number } = {};
    BbsEngine.STANDARD_DIAMETERS.forEach((d) => (totals[d] = 0));

    let grandLen = 0;
    let grandWt = 0;

    filteredItems.forEach((item) => {
      grandLen += item.totalLengthM;
      const unitWt = (item.diameter * item.diameter) / 162.2;
      const wt = item.totalLengthM * unitWt;
      grandWt += wt;

      if (totals[item.diameter] !== undefined) {
        totals[item.diameter] += item.totalLengthM;
      }
    });

    return {
      totals,
      grandLen: Number(grandLen.toFixed(2)),
      grandWtKg: Number(grandWt.toFixed(2)),
      grandWtMT: Number((grandWt / 1000).toFixed(3)),
    };
  }, [filteredItems]);

  const formatDim = (valMm: number) => {
    if (valMm === 0) return '-';
    if (unit === 'm') {
      return (valMm / 1000).toFixed(3);
    }
    return Math.round(valMm).toString();
  };

  const formatCutLen = (valM: number) => {
    if (unit === 'mm') {
      return Math.round(valM * 1000).toString();
    }
    return valM.toFixed(2);
  };

  // Export to CSV / Excel compatible format
  const handleExportCsv = () => {
    const headers = [
      'Bar No',
      'Element Group',
      'Bar Description',
      'Shape',
      `a (${unit})`,
      `b (${unit})`,
      `c (${unit})`,
      'Dia (mm)',
      'Spacing (mm)',
      `Cutting Length (${unit})`,
      'Total Count',
      'Length 8mm (m)',
      'Length 10mm (m)',
      'Length 12mm (m)',
      'Length 16mm (m)',
      'Length 20mm (m)',
      'Length 25mm (m)',
      'Length 28mm (m)',
      'Length 32mm (m)',
      'Total Length (m)',
      'Total Weight (kg)',
    ];

    const rows = filteredItems.map((item) => [
      item.barNo,
      `"${item.elementTag}"`,
      `"${item.barDescription}"`,
      item.shapeType,
      formatDim(item.a),
      formatDim(item.b),
      formatDim(item.c),
      item.diameter,
      item.spacing || '-',
      formatCutLen(item.cuttingLengthM),
      item.totalCount,
      item.diameter === 8 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 10 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 12 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 16 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 20 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 25 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 28 ? item.totalLengthM.toFixed(2) : '',
      item.diameter === 32 ? item.totalLengthM.toFixed(2) : '',
      item.totalLengthM.toFixed(2),
      (item.totalLengthM * ((item.diameter * item.diameter) / 162.2)).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${bbsData.projectName.replace(/\s+/g, '_')}_Bar_Bending_Schedule_BBS.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Professional Group-Wise Printable HTML Document / PDF
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const groupSectionsHtml = groups
      .map((grp) => {
        const groupHeader = `
        <tr style="background-color: #1e293b; color: #ffffff; font-weight: bold;">
          <td colspan="${10 + BbsEngine.STANDARD_DIAMETERS.length}" style="padding: 7px 10px; font-size: 11px;">
            <span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-right: 8px;">${grp.category}</span>
            ${grp.tag} &mdash; (${grp.items.length} Bar Types &bull; Total Weight: ${grp.totalWeightKg.toFixed(1)} kg)
          </td>
        </tr>
      `;

        const itemRows = grp.items
          .map((item, idx) => {
            const unitMultiplier = unit === 'mm' ? 1000 : 1;
            const formattedLen = (item.totalLengthM * unitMultiplier).toFixed(unit === 'mm' ? 0 : 1);
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            return `
          <tr style="background-color: ${bg};">
            <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 4px;">${item.barNo}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold;">
              <div>${item.elementTag}</div>
              <div style="font-size: 9px; color: #64748b; font-weight: normal;">${item.barDescription}</div>
            </td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #2563eb;">${item.shapeType}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${formatDim(item.a)}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${formatDim(item.b)}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${formatDim(item.c)}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #1d4ed8;">${item.diameter}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${item.spacing || '-'}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px; font-weight: bold;">${formatCutLen(item.cuttingLengthM)}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #1d4ed8;">${item.totalCount}</td>
            ${BbsEngine.STANDARD_DIAMETERS.map((dia) => {
              const isMatch = item.diameter === dia;
              return `<td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: ${isMatch ? '#dc2626' : '#cbd5e1'}; background-color: ${isMatch ? '#fef2f2' : 'transparent'};">${isMatch ? formattedLen : ''}</td>`;
            }).join('')}
          </tr>
        `;
          })
          .join('');

        const groupSubtotal = `
        <tr style="background-color: #f1f5f9; font-weight: bold; border-bottom: 2px solid #334155;">
          <td colspan="10" style="text-align: right; padding: 5px 8px; font-size: 10px; color: #1e293b;">
            SUBTOTAL [${grp.tag}]:
          </td>
          ${BbsEngine.STANDARD_DIAMETERS.map((d) => {
            const len = (grp.lengthByDia[d] || 0) * (unit === 'mm' ? 1000 : 1);
            return `<td style="text-align: center; border: 1px solid #cbd5e1; padding: 5px; color: #0284c7;">${len > 0 ? (unit === 'mm' ? Math.round(len).toLocaleString() : len.toFixed(1)) : '-'}</td>`;
          }).join('')}
        </tr>
      `;

        return groupHeader + itemRows + groupSubtotal;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bar Bending Schedule (BBS) — ${bbsData.projectName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #0f172a; font-size: 10px; }
          .header-box { border: 2px solid #0f172a; margin-bottom: 12px; }
          .title { background: #334155; color: #fff; text-align: center; padding: 6px; font-size: 14px; font-weight: bold; text-transform: uppercase; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #0f172a; font-size: 10px; }
          .meta-cell { padding: 6px 10px; border-right: 1px solid #cbd5e1; }
          .meta-cell:last-child { border-right: none; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-family: monospace; font-size: 10px; }
          th { background: #1e293b; color: #fff; padding: 5px 4px; border: 1px solid #475569; font-size: 9.5px; }
          tfoot tr { font-weight: bold; }
          .summary-banner { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 10px 16px; margin-top: 12px; border-radius: 4px; }
          @media print {
            body { margin: 8mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title">Group-Wise Bar Bending Schedule (IS:2502 / SP:34 Standard Detailing)</div>
          <div class="meta-grid">
            <div class="meta-cell"><b>Project:</b> <span style="color:#1d4ed8;">${bbsData.projectName}</span><br><b>Ref Dwg:</b> ${bbsData.refDwgNo}</div>
            <div class="meta-cell"><b>Engineer:</b> <span style="color:#1d4ed8;">${bbsData.engineer}</span><br><b>Approver:</b> Project Manager</div>
            <div class="meta-cell"><b>Revision:</b> ${bbsData.revision}<br><b>Status:</b> <span style="color:#16a34a;">${bbsData.status}</span></div>
            <div class="meta-cell"><b>Doc No:</b> ${bbsData.docNo}<br><b>Date:</b> ${bbsData.date}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="2">Bar no.</th>
              <th rowspan="2" style="text-align: left;">Element Tag</th>
              <th rowspan="2">Shape</th>
              <th rowspan="2">a (${unit})</th>
              <th rowspan="2">b (${unit})</th>
              <th rowspan="2">c (${unit})</th>
              <th rowspan="2">Dia</th>
              <th rowspan="2">Spacing</th>
              <th rowspan="2">Cut Len (${unit})</th>
              <th rowspan="2">no's</th>
              <th colspan="8" style="background: #334155;">Length of Bar (${unit}) by Diameter</th>
            </tr>
            <tr>
              ${BbsEngine.STANDARD_DIAMETERS.map((d) => `<th>${d}Ø</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${groupSectionsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0;">
              <td colspan="10" style="text-align: right; padding: 6px; border: 1px solid #cbd5e1;">TOTAL LENGTH (${unit}):</td>
              ${BbsEngine.STANDARD_DIAMETERS.map((d) => {
                const len = filteredDiameterTotals.totals[d] * (unit === 'mm' ? 1000 : 1);
                return `<td style="text-align: center; border: 1px solid #cbd5e1; color: #1d4ed8; padding: 6px;">${len > 0 ? (unit === 'mm' ? Math.round(len).toLocaleString() : len.toFixed(1)) : '-'}</td>`;
              }).join('')}
            </tr>
            <tr style="background: #f1f5f9;">
              <td colspan="10" style="text-align: right; padding: 6px; border: 1px solid #cbd5e1;">UNIT WEIGHT (kg/m):</td>
              ${BbsEngine.STANDARD_DIAMETERS.map((d) => `<td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${((d * d) / 162.2).toFixed(3)}</td>`).join('')}
            </tr>
            <tr style="background: #e2e8f0; color: #b91c1c;">
              <td colspan="10" style="text-align: right; padding: 6px; border: 1px solid #cbd5e1;">TOTAL WEIGHT (kg):</td>
              ${BbsEngine.STANDARD_DIAMETERS.map((d) => {
                const wt = filteredDiameterTotals.totals[d] * ((d * d) / 162.2);
                return `<td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${wt > 0 ? Math.round(wt).toLocaleString() : '-'}</td>`;
              }).join('')}
            </tr>
          </tfoot>
        </table>

        <div class="summary-banner">
          <div>
            <b>TOTAL STEEL TAKEOFF:</b> <span style="color:#38bdf8; font-size:13px; font-weight:bold; margin-left:8px;">${filteredDiameterTotals.grandWtKg.toLocaleString()} kg (${filteredDiameterTotals.grandWtMT} MT)</span>
          </div>
          <div style="font-size:9px; color:#94a3b8;">IS:2502-1963 &bull; SP:34 (S&T)-1987 Compliant</div>
        </div>

        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col w-full space-y-4 font-mono select-none">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-950 rounded border border-sky-800 text-sky-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              BAR BENDING SCHEDULE (BBS) — IS 2502 / SP:34
            </h2>
            <p className="text-xs text-slate-400">
              {groups.length} Member Groups • {filteredItems.length} Bar Types • Steel Takeoff: {filteredDiameterTotals.grandWtKg.toLocaleString()} kg ({filteredDiameterTotals.grandWtMT} MT)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Grouping Mode Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-700">
            <span className="text-slate-400 px-2 font-semibold flex items-center gap-1">
              <ListTree className="w-3.5 h-3.5 text-sky-400" /> GROUP:
            </span>
            <button
              onClick={() => setGroupBy('MEMBER')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                groupBy === 'MEMBER' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Group items by individual member / element tag"
            >
              MEMBER WISE
            </button>
            <button
              onClick={() => setGroupBy('CATEGORY')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                groupBy === 'CATEGORY' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Group items by component category (Beams, Columns, Pile Caps)"
            >
              CATEGORY WISE
            </button>
            <button
              onClick={() => setGroupBy('FLAT')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                groupBy === 'FLAT' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="View flat list of all bar entries"
            >
              FLAT LIST
            </button>
          </div>

          {/* Expand / Collapse All */}
          {groupBy !== 'FLAT' && (
            <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-700 gap-1">
              <button
                onClick={handleExpandAll}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
                title="Expand all member groups"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" /> Expand All
              </button>
              <button
                onClick={handleCollapseAll}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
                title="Collapse all member groups"
              >
                <FolderMinus className="w-3.5 h-3.5 text-amber-400" /> Collapse All
              </button>
            </div>
          )}

          {/* Unit Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-700">
            <span className="text-slate-400 px-2 font-semibold">UNIT:</span>
            <button
              onClick={() => setUnit('m')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                unit === 'm' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              METERS (m)
            </button>
            <button
              onClick={() => setUnit('mm')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                unit === 'mm' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              MILLIMETERS (mm)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Tag / Dia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 text-white text-xs pl-8 pr-3 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-sky-500 w-44"
            />
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold shadow transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel (.csv)
          </button>

          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold shadow transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF BBS
          </button>
        </div>
      </div>

      {/* Category Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'ALL', label: 'ALL MEMBERS (FULL BUILDING BBS)', icon: Layers },
          { id: 'BEAM', label: 'BEAMS (FLOOR FRAMING)', icon: Compass },
          { id: 'COLUMN', label: 'COLUMNS (STOREY STACKS)', icon: Building },
          { id: 'SHEAR_WALL', label: 'SHEAR WALLS', icon: Layers },
          { id: 'PILE_CAP', label: 'PILE CAPS & FOUNDATIONS', icon: Box },
          { id: 'GRADE_BEAM', label: 'GRADE TIE BEAMS', icon: Compass },
          { id: 'SLAB', label: 'FLOOR SLABS', icon: Grid },
          { id: 'STAIRCASE', label: 'STAIRCASES & WAIST FLIGHTS', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all font-semibold ${
                isActive
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Bar Bending Schedule Table Container (Authentic Format matching reference) */}
      <div className="w-full bg-white text-slate-900 rounded-lg shadow-2xl overflow-x-auto border-2 border-slate-800">
        {/* BBS Header Banner (CivilDigital / IS 2502 Standard) */}
        <div className="w-full bg-slate-300 border-b-2 border-slate-800 py-1.5 text-center font-bold text-sm text-slate-900 uppercase tracking-wide">
          Bar Bending Schedule (IS:2502 / SP:34 Standard Detailing)
        </div>

        {/* Project Meta Details Header Grid */}
        <div className="grid grid-cols-4 border-b-2 border-slate-800 text-xs divide-x-2 divide-slate-800 bg-slate-50 font-sans">
          <div className="p-2 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Project Name:</span>
              <span className="font-bold text-blue-700">{bbsData.projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Ref Dwg. No:</span>
              <span className="font-semibold text-slate-900">{bbsData.refDwgNo}</span>
            </div>
          </div>

          <div className="p-2 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Engineer:</span>
              <span className="font-semibold text-blue-700">{bbsData.engineer}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Approver:</span>
              <span className="font-semibold text-slate-900">Project Manager</span>
            </div>
          </div>

          <div className="p-2 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Revision:</span>
              <span className="font-bold text-slate-900">{bbsData.revision}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Status:</span>
              <span className="font-bold text-blue-700">{bbsData.status}</span>
            </div>
          </div>

          <div className="p-2 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Doc. No:</span>
              <span className="font-bold text-slate-900">{bbsData.docNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Date:</span>
              <span className="font-semibold text-blue-700">{bbsData.date}</span>
            </div>
          </div>
        </div>

        {/* BBS Data Table */}
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            {/* Multi-Level Table Header */}
            <tr className="bg-slate-200 text-slate-900 border-b-2 border-slate-800 text-center font-bold">
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-12">
                Bar no.
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-32 text-left">
                Element Tag
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-36 text-center">
                Bar Shape
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-16">
                a ({unit})
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-20">
                b ({unit})
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-16">
                c ({unit})
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-14">
                Dia (mm)
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-16">
                Spacing (mm)
              </th>
              <th rowSpan={2} className="border-r border-slate-400 p-2 w-20">
                Cutting Length ({unit})
              </th>
              <th rowSpan={2} className="border-r-2 border-slate-800 p-2 w-12">
                no's
              </th>
              <th colSpan={8} className="border-b border-slate-400 p-1 text-center bg-slate-300">
                Length of Bar ({unit})
              </th>
            </tr>
            <tr className="bg-slate-200 text-slate-900 border-b-2 border-slate-800 text-center font-bold">
              {BbsEngine.STANDARD_DIAMETERS.map((dia) => (
                <th key={`dia_hdr_${dia}`} className="border-r border-slate-400 p-1.5 w-14">
                  {dia}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {groups.map((grp) => {
              const isCollapsed = collapsedGroups.has(grp.tag);

              return (
                <React.Fragment key={grp.tag}>
                  {/* Group Header Banner Row */}
                  {groupBy !== 'FLAT' && (
                    <tr className="bg-slate-800 text-white font-sans text-xs border-b border-slate-700 hover:bg-slate-750 transition-colors">
                      <td colSpan={10 + BbsEngine.STANDARD_DIAMETERS.length} className="p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleGroup(grp.tag)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                              title={isCollapsed ? 'Expand Group' : 'Collapse Group'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-sky-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-sky-400" />
                              )}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                                grp.category === 'PILE_CAP'
                                  ? 'bg-indigo-600 text-white'
                                  : grp.category === 'COLUMN'
                                  ? 'bg-emerald-600 text-white'
                                  : grp.category === 'BEAM'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-purple-600 text-white'
                              }`}
                            >
                              {grp.category}
                            </span>
                            <span className="font-bold text-sm text-white tracking-tight">{grp.tag}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({grp.items.length} {grp.items.length === 1 ? 'bar type' : 'bar types'})
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] font-mono">
                            <span className="text-slate-300">
                              Len: <strong className="text-sky-300">{grp.totalLengthM.toFixed(1)} m</strong>
                            </span>
                            <span className="text-slate-300">
                              Weight: <strong className="text-emerald-300">{grp.totalWeightKg.toFixed(1)} kg</strong>
                            </span>
                            <span className="text-slate-400">
                              ({(grp.totalWeightKg / 1000).toFixed(3)} MT)
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Group Items */}
                  {!isCollapsed &&
                    grp.items.map((item, idx) => {
                      const unitMultiplier = unit === 'mm' ? 1000 : 1;
                      const formattedLen = (item.totalLengthM * unitMultiplier).toFixed(unit === 'mm' ? 0 : 1);

                      return (
                        <tr key={item.barNo} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70 hover:bg-sky-50/50'}>
                          <td className="border-r border-slate-300 p-2 text-center font-bold text-slate-700">
                            {item.barNo}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-left font-bold text-slate-900">
                            <div className="text-[11px] text-slate-900">{item.elementTag}</div>
                            <div className="text-[9.5px] text-slate-500 font-sans">{item.barDescription}</div>
                          </td>
                          <td className="border-r border-slate-300 p-1 text-center bg-slate-50/50">
                            <div className="flex justify-center">
                              <BbsShapeSvg
                                shapeType={item.shapeType}
                                a={item.a}
                                b={item.b}
                                c={item.c}
                                unit={unit}
                                width={90}
                                height={46}
                              />
                            </div>
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-700 font-medium">
                            {formatDim(item.a)}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-700 font-medium">
                            {formatDim(item.b)}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-700 font-medium">
                            {formatDim(item.c)}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center font-bold text-blue-700">
                            {item.diameter}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center text-blue-700">
                            {item.spacing || '-'}
                          </td>
                          <td className="border-r border-slate-300 p-2 text-center font-bold text-slate-900">
                            {formatCutLen(item.cuttingLengthM)}
                          </td>
                          <td className="border-r-2 border-slate-800 p-2 text-center font-bold text-blue-700">
                            {item.totalCount}
                          </td>

                          {/* Length by Diameter Columns */}
                          {BbsEngine.STANDARD_DIAMETERS.map((dia) => {
                            const isMatching = item.diameter === dia;
                            return (
                              <td
                                key={`len_${item.barNo}_${dia}`}
                                className={`border-r border-slate-300 p-2 text-center ${
                                  isMatching ? 'text-red-600 font-bold bg-red-50/40' : 'text-slate-300'
                                }`}
                              >
                                {isMatching ? formattedLen : ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                  {/* Group Subtotal Row */}
                  {!isCollapsed && groupBy !== 'FLAT' && (
                    <tr className="bg-sky-50/80 border-b-2 border-slate-400 font-bold text-xs">
                      <td colSpan={10} className="border-r-2 border-slate-800 p-2 text-right uppercase tracking-wider text-slate-800">
                        Subtotal [{grp.tag}] ({grp.totalWeightKg.toFixed(1)} kg):
                      </td>
                      {BbsEngine.STANDARD_DIAMETERS.map((dia) => {
                        const len = (grp.lengthByDia[dia] || 0) * (unit === 'mm' ? 1000 : 1);
                        return (
                          <td key={`subtot_${grp.tag}_${dia}`} className="border-r border-slate-400 p-2 text-center text-sky-800 font-bold bg-sky-100/50">
                            {len > 0 ? (unit === 'mm' ? Math.round(len).toLocaleString() : len.toFixed(1)) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Table Summary Takeoff Rows at Bottom */}
          <tfoot className="border-t-2 border-slate-800 bg-slate-100 divide-y divide-slate-400 font-bold text-xs">
            {/* Total Length Row */}
            <tr className="bg-slate-200">
              <td colSpan={10} className="border-r-2 border-slate-800 p-2 text-right uppercase tracking-wider text-slate-800">
                Total Length of Bar ({unit}):
              </td>
              {BbsEngine.STANDARD_DIAMETERS.map((dia) => {
                const len = filteredDiameterTotals.totals[dia] * (unit === 'mm' ? 1000 : 1);
                return (
                  <td key={`tot_len_${dia}`} className="border-r border-slate-400 p-2 text-center text-blue-700 font-bold">
                    {len > 0 ? (unit === 'mm' ? Math.round(len).toLocaleString() : len.toFixed(1)) : '-'}
                  </td>
                );
              })}
            </tr>

            {/* Unit Weight Row (kg/m) */}
            <tr className="bg-slate-200/80">
              <td colSpan={10} className="border-r-2 border-slate-800 p-2 text-right uppercase tracking-wider text-slate-700">
                Unit Weight (kg/m = Ø²/162.2):
              </td>
              {BbsEngine.STANDARD_DIAMETERS.map((dia) => (
                <td key={`unit_wt_${dia}`} className="border-r border-slate-400 p-2 text-center text-slate-700 font-semibold">
                  {((dia * dia) / 162.2).toFixed(3)}
                </td>
              ))}
            </tr>

            {/* Total Weight Row (kg) */}
            <tr className="bg-slate-300 text-red-700">
              <td colSpan={10} className="border-r-2 border-slate-800 p-2 text-right uppercase tracking-wider text-slate-900">
                Total Weight of Steel (kg):
              </td>
              {BbsEngine.STANDARD_DIAMETERS.map((dia) => {
                const wt = filteredDiameterTotals.totals[dia] * ((dia * dia) / 162.2);
                return (
                  <td key={`tot_wt_${dia}`} className="border-r border-slate-400 p-2 text-center font-bold text-red-700">
                    {wt > 0 ? Math.round(wt).toLocaleString() : '-'}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>

        {/* Grand Total Summary Box */}
        <div className="flex flex-wrap items-center justify-between p-4 bg-slate-900 text-white rounded-b-lg border-t-2 border-slate-800">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-400 uppercase font-sans">Total Length:</span>
              <div className="text-base font-bold text-sky-400">
                {filteredDiameterTotals.grandLen.toLocaleString()} m
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div>
              <span className="text-xs text-slate-400 uppercase font-sans">Gross Steel Weight:</span>
              <div className="text-base font-bold text-emerald-400">
                {filteredDiameterTotals.grandWtKg.toLocaleString()} kg
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div>
              <span className="text-xs text-slate-400 uppercase font-sans">Metric Tonnes:</span>
              <div className="text-base font-bold text-amber-400">
                {filteredDiameterTotals.grandWtMT} MT
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 font-sans">
            Prepared in accordance with <span className="text-white font-mono font-bold">IS:2502-1963</span> &amp; <span className="text-white font-mono font-bold">SP:34 (S&amp;T)-1987</span>
          </div>
        </div>
      </div>
    </div>
  );
};
