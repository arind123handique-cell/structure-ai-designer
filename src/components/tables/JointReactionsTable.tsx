import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DataTable, ColumnDef } from './DataTable';
import { JointReaction } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { exportToCsv } from '@/utils/exportUtils';
import { ArrowUpDown, Building, Filter } from 'lucide-react';

interface DisplayedReactionRow extends JointReaction {
  columnSlNo: number;
  columnLabel: string;
  gridLabel?: string;
}

export const JointReactionsTable: React.FC = () => {
  const { activeModel, selectNode, setActiveView } = useProjectStore();
  const [filterMode, setFilterMode] = useState<'ALL' | 'MAX_FY_PER_JOINT'>('MAX_FY_PER_JOINT');

  if (!activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active model loaded.
      </div>
    );
  }

  const rawReactions = activeModel.reactions;

  // Get automatically arranged column numbering mapping
  const columnMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(activeModel);
  }, [activeModel]);

  // Map raw reactions to rows with Column Sl No
  const allRows: DisplayedReactionRow[] = useMemo(() => {
    return rawReactions.map((r) => {
      const colInfo = columnMapping.get(r.nodeId);
      return {
        ...r,
        columnSlNo: colInfo?.columnSlNo || r.nodeId,
        columnLabel: colInfo?.columnLabel || `C${r.nodeId}`,
        gridLabel: colInfo?.gridLabel,
      };
    });
  }, [rawReactions, columnMapping]);

  // Filter to max vertical load (FY) per joint if selected
  const displayedReactions = useMemo(() => {
    if (filterMode === 'ALL') {
      return allRows.sort((a, b) => {
        if (a.columnSlNo !== b.columnSlNo) return a.columnSlNo - b.columnSlNo;
        return a.loadCaseId - b.loadCaseId;
      });
    }

    const jointMap = new Map<number, DisplayedReactionRow>();
    for (const r of allRows) {
      const existing = jointMap.get(r.nodeId);
      if (!existing || r.fy > existing.fy) {
        jointMap.set(r.nodeId, r);
      }
    }
    return Array.from(jointMap.values()).sort((a, b) => a.columnSlNo - b.columnSlNo);
  }, [allRows, filterMode]);

  const columns: ColumnDef<DisplayedReactionRow>[] = [
    {
      header: 'JOINT = COLUMN SL NO = PILE CAP',
      accessorKey: 'columnSlNo',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-1.5 font-mono">
          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs shadow-2xs">
            {r.columnLabel}
          </span>
          <span className="font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[11px]">
            PC-{r.columnSlNo}
          </span>
          <span className="text-[11px] text-slate-500 font-normal" title={r.gridLabel}>
            (Joint #{r.nodeId})
          </span>
        </div>
      ),
      width: '240px',
    },
    {
      header: 'LOAD CASE',
      accessorKey: 'loadCaseId',
      sortable: true,
      align: 'center',
      cell: (r) => <span className="text-slate-700 font-mono font-semibold">LC {r.loadCaseId}</span>,
      width: '100px',
    },
    {
      header: 'VERTICAL FY (kN)',
      accessorKey: 'fy',
      sortable: true,
      align: 'right',
      cell: (r) => (
        <span
          className={`font-mono font-bold ${
            r.fy >= 1000 ? 'text-red-700' : r.fy >= 500 ? 'text-amber-700' : 'text-slate-800'
          }`}
        >
          {r.fy.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'LATERAL FX (kN)',
      accessorKey: 'fx',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="text-slate-600 font-mono">{r.fx.toFixed(2)}</span>,
    },
    {
      header: 'LATERAL FZ (kN)',
      accessorKey: 'fz',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="text-slate-600 font-mono">{r.fz.toFixed(2)}</span>,
    },
    {
      header: 'MOMENT MX (kNm)',
      accessorKey: 'mx',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="text-slate-600 font-mono">{r.mx.toFixed(2)}</span>,
    },
    {
      header: 'MOMENT MY (kNm)',
      accessorKey: 'my',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="text-slate-600 font-mono">{r.my.toFixed(2)}</span>,
    },
    {
      header: 'MOMENT MZ (kNm)',
      accessorKey: 'mz',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="text-slate-600 font-mono">{r.mz.toFixed(2)}</span>,
    },
  ];

  const handleExport = () => {
    exportToCsv(
      displayedReactions.map((r) => ({
        ColumnSlNo: r.columnLabel,
        SupportNode: r.nodeId,
        LoadCase: r.loadCaseId,
        FY_Vertical_kN: r.fy,
        FX_kN: r.fx,
        FZ_kN: r.fz,
        MX_kNm: r.mx,
        MY_kNm: r.my,
        MZ_kNm: r.mz,
      })),
      'STAAD_Column_Support_Reactions.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-4 bg-ui-background overflow-hidden font-sans">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between bg-surface-card p-3 rounded-md border border-ui-border shadow-xs">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-emerald-700" />
          <span className="font-mono text-xs font-bold text-deep-navy">
            AUTOMATICALLY NUMBERED COLUMNS ({columnMapping.size} Ground Supports)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 uppercase font-semibold">View Mode:</span>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              filterMode === 'ALL'
                ? 'bg-deep-navy text-white border-deep-navy shadow-xs font-bold'
                : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
            }`}
          >
            All Load Cases ({allRows.length})
          </button>
          <button
            onClick={() => setFilterMode('MAX_FY_PER_JOINT')}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              filterMode === 'MAX_FY_PER_JOINT'
                ? 'bg-deep-navy text-white border-deep-navy shadow-xs font-bold'
                : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
            }`}
          >
            Governing Max FY Only ({columnMapping.size})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DataTable
          data={displayedReactions}
          columns={columns}
          title="FOUNDATION SUPPORT REACTIONS & COLUMN SERIAL SCHEDULE"
          searchPlaceholder="Search by Column (e.g. C-1) or Joint #..."
          searchFilter={(item, q) =>
            item.columnLabel.toLowerCase().includes(q) ||
            String(item.nodeId).includes(q) ||
            String(item.loadCaseId).includes(q)
          }
          onExportCsv={handleExport}
        />
      </div>
    </div>
  );
};
