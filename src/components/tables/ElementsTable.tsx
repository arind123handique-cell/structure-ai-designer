import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DataTable, ColumnDef } from './DataTable';
import { Member3D } from '@/features/model/types';
import { exportToCsv } from '@/utils/exportUtils';
import { BuildingDetailsPanel } from '@/components/engineering/BuildingDetailsPanel';
import { Layers, Building, Ruler, FileSpreadsheet } from 'lucide-react';

export const ElementsTable: React.FC = () => {
  const { activeModel, selectMember, setActiveView } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'ELEMENTS' | 'BUILDING_DETAILS'>('BUILDING_DETAILS');
  const [filterType, setFilterType] = useState<'ALL' | 'BEAM' | 'COLUMN' | 'BRACE'>('ALL');

  if (!activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active model loaded.
      </div>
    );
  }

  const nodes = activeModel.nodes;
  const members = Array.from(activeModel.members.values()).filter((m) => {
    if (filterType === 'ALL') return true;
    return m.classification === filterType;
  });

  const columns: ColumnDef<Member3D>[] = [
    {
      header: 'MEMBER ID',
      accessorKey: 'id',
      sortable: true,
      cell: (r) => <span className="font-bold text-secondary-brand">#{r.id}</span>,
      width: '110px',
    },
    {
      header: 'TYPE',
      accessorKey: 'classification',
      sortable: true,
      cell: (r) => {
        const isCol = r.classification === 'COLUMN';
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              isCol ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {r.classification}
          </span>
        );
      },
      width: '110px',
    },
    {
      header: 'START NODE (X, Y, Z)',
      cell: (r) => {
        const n = nodes.get(r.startNodeId);
        return n ? (
          <span className="text-slate-600">
            #{r.startNodeId} ({n.x.toFixed(2)}, {n.y.toFixed(2)}, {n.z.toFixed(2)})
          </span>
        ) : (
          `#${r.startNodeId}`
        );
      },
    },
    {
      header: 'END NODE (X, Y, Z)',
      cell: (r) => {
        const n = nodes.get(r.endNodeId);
        return n ? (
          <span className="text-slate-600">
            #{r.endNodeId} ({n.x.toFixed(2)}, {n.y.toFixed(2)}, {n.z.toFixed(2)})
          </span>
        ) : (
          `#${r.endNodeId}`
        );
      },
    },
    {
      header: 'LENGTH (m)',
      accessorKey: 'length',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="font-semibold text-slate-800">{r.length.toFixed(2)}</span>,
      width: '110px',
    },
    {
      header: 'SECTION',
      cell: (r) => <span className="text-slate-700 font-semibold">{r.section.name || '300x450 mm'}</span>,
      width: '130px',
    },
    {
      header: 'MATERIAL',
      accessorKey: 'materialName',
      cell: (r) => <span className="text-slate-500 font-mono text-[11px]">{r.materialName}</span>,
      width: '110px',
    },
    {
      header: 'ACTION',
      align: 'center',
      cell: (r) => (
        <button
          type="button"
          onClick={() => {
            selectMember(r.id);
            setActiveView('3d-model');
          }}
          className="px-2.5 py-1 text-[11px] bg-secondary-brand/10 hover:bg-secondary-brand/20 text-secondary-brand rounded font-mono font-semibold transition-colors"
        >
          View in 3D
        </button>
      ),
      width: '100px',
    },
  ];

  const handleExport = () => {
    exportToCsv(
      members.map((m) => ({
        ID: m.id,
        Type: m.classification,
        StartNode: m.startNodeId,
        EndNode: m.endNodeId,
        Length_m: m.length,
        Section: m.section.name || '',
        Material: m.materialName,
      })),
      'Structural_Members_STAAD.csv'
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-mono overflow-hidden select-none">
      {/* Analysis & Geometry Top Switcher Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('BUILDING_DETAILS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold transition-all border ${
              activeTab === 'BUILDING_DETAILS'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4 text-indigo-300" />
            <span>Building Details &amp; Centerline Panel</span>
          </button>

          <button
            onClick={() => setActiveTab('ELEMENTS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold transition-all border ${
              activeTab === 'ELEMENTS'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-sky-300" />
            <span>Structural Elements Table ({members.length})</span>
          </button>
        </div>

        {activeTab === 'ELEMENTS' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[11px]">Filter:</span>
            {(['ALL', 'BEAM', 'COLUMN', 'BRACE'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setFilterType(cls)}
                className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                  filterType === cls
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'BUILDING_DETAILS' ? (
          <BuildingDetailsPanel />
        ) : (
          <div className="p-4 h-full flex flex-col space-y-3">
            <DataTable
              data={members}
              columns={columns}
              title="STAAD STRUCTURAL MEMBERS & INCIDENCES"
              searchPlaceholder="Search by member # or section..."
              searchFilter={(item, q) =>
                String(item.id).includes(q) ||
                item.classification.toLowerCase().includes(q) ||
                String(item.section.name || '').toLowerCase().includes(q)
              }
              onExportCsv={handleExport}
              onRowClick={(r) => selectMember(r.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
