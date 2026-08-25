import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DataTable, ColumnDef } from './DataTable';
import { MemberForceRecord } from '@/features/model/types';
import { exportToCsv } from '@/utils/exportUtils';

export const MemberForcesTable: React.FC = () => {
  const { activeModel, selectMember, setActiveView } = useProjectStore();
  const [filterClassification, setFilterClassification] = useState<'ALL' | 'BEAM' | 'COLUMN'>('ALL');

  if (!activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active model loaded. Please import a STAAD .ANL file.
      </div>
    );
  }

  // Combine Member details with forces
  const rawForces = activeModel.memberForces;
  const members = activeModel.members;

  const rows = (rawForces.length > 0 ? rawForces : Array.from(members.values()).map((m) => ({
    memberId: m.id,
    loadCaseId: 1,
    sectionLocation: 0,
    axial: 0,
    vy: 0,
    vz: 0,
    torsion: 0,
    my: 0,
    mz: 0,
  }))).filter((f) => {
    if (filterClassification === 'ALL') return true;
    const mem = members.get(f.memberId);
    return mem?.classification === filterClassification;
  });

  const columns: ColumnDef<MemberForceRecord>[] = [
    {
      header: 'MEMBER #',
      accessorKey: 'memberId',
      sortable: true,
      cell: (r) => (
        <span className="font-bold text-secondary-brand">#{r.memberId}</span>
      ),
      width: '100px',
    },
    {
      header: 'TYPE',
      cell: (r) => {
        const mem = members.get(r.memberId);
        const isCol = mem?.classification === 'COLUMN';
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              isCol ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {mem?.classification || 'BEAM'}
          </span>
        );
      },
      width: '100px',
    },
    {
      header: 'SECTION',
      cell: (r) => {
        const mem = members.get(r.memberId);
        return <span className="text-slate-700">{mem?.section.name || '300x450 mm'}</span>;
      },
      width: '120px',
    },
    {
      header: 'LENGTH (m)',
      cell: (r) => {
        const mem = members.get(r.memberId);
        return <span>{mem?.length.toFixed(2)}</span>;
      },
      align: 'right',
      width: '100px',
    },
    {
      header: 'LOAD CASE',
      accessorKey: 'loadCaseId',
      sortable: true,
      align: 'center',
      cell: (r) => <span className="text-slate-600">LC {r.loadCaseId}</span>,
      width: '100px',
    },
    {
      header: 'AXIAL Pu (kN)',
      accessorKey: 'axial',
      sortable: true,
      align: 'right',
      cell: (r) => (
        <span className={r.axial > 0 ? 'text-blue-600' : r.axial < 0 ? 'text-amber-700' : 'text-slate-500'}>
          {r.axial.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'SHEAR Vy (kN)',
      accessorKey: 'vy',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="font-semibold text-slate-800">{r.vy.toFixed(2)}</span>,
    },
    {
      header: 'MOMENT Mz (kNm)',
      accessorKey: 'mz',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="font-semibold text-slate-800">{r.mz.toFixed(2)}</span>,
    },
    {
      header: 'ACTION',
      align: 'center',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            selectMember(r.memberId);
            setActiveView('3d-model');
          }}
          className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-secondary-brand hover:text-white rounded border border-ui-border transition-colors font-mono"
        >
          Inspect
        </button>
      ),
      width: '90px',
    },
  ];

  const handleExport = () => {
    exportToCsv(
      rows.map((r) => ({
        MemberId: r.memberId,
        Type: members.get(r.memberId)?.classification || 'BEAM',
        Section: members.get(r.memberId)?.section.name || '',
        Length: members.get(r.memberId)?.length || 0,
        LoadCase: r.loadCaseId,
        Axial_kN: r.axial,
        Shear_kN: r.vy,
        Moment_kNm: r.mz,
      })),
      'Member_Forces_STAAD.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-4 bg-ui-background overflow-hidden">
      {/* Table Filters Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 font-semibold uppercase">Filter Elements:</span>
          {(['ALL', 'BEAM', 'COLUMN'] as const).map((cls) => (
            <button
              key={cls}
              onClick={() => setFilterClassification(cls)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                filterClassification === cls
                  ? 'bg-deep-navy text-white border-deep-navy shadow-sm'
                  : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DataTable
          data={rows}
          columns={columns}
          title="MEMBER ANALYSIS FORCES & ENVELOPES"
          searchPlaceholder="Search by member #, load case..."
          searchFilter={(item, q) =>
            String(item.memberId).includes(q) ||
            String(item.loadCaseId).includes(q) ||
            String(members.get(item.memberId)?.section.name || '').toLowerCase().includes(q)
          }
          onExportCsv={handleExport}
          onRowClick={(r) => selectMember(r.memberId)}
        />
      </div>
    </div>
  );
};
