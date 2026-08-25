import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DataTable, ColumnDef } from './DataTable';
import { LoadCase } from '@/features/model/types';
import { LateralLoadAuditor } from '@/features/anl/lateralLoadAuditor';
import { IS456LoadCombinations, StandardLoadCombination } from '@/features/codes/is456/loadCombinations';
import { exportToCsv } from '@/utils/exportUtils';
import { ShieldCheck, AlertTriangle, Layers, Activity, Wind, Sparkles } from 'lucide-react';

export const LoadCasesTable: React.FC = () => {
  const { activeModel, activeProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'STAAD_LOADS' | 'IS_COMBINATIONS'>('STAAD_LOADS');

  if (!activeModel) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
        No active model loaded.
      </div>
    );
  }

  const loadCases = Array.from(activeModel.loadCases.values()).sort((a, b) => a.id - b.id);
  const loadCombinations = activeModel.loadCombinations;

  // Run Lateral Load Audit
  const auditResult = useMemo(() => {
    const rawContent = activeProject?.rawAnlContent || '';
    return LateralLoadAuditor.audit(rawContent, loadCases as any);
  }, [activeProject?.rawAnlContent, loadCases]);

  const isCombinations = useMemo(() => {
    return IS456LoadCombinations.getStandardCombinations();
  }, []);

  const staadColumns: ColumnDef<LoadCase>[] = [
    {
      header: 'LOAD CASE #',
      accessorKey: 'id',
      sortable: true,
      cell: (r) => <span className="font-bold text-secondary-brand font-mono">LC #{r.id}</span>,
      width: '120px',
    },
    {
      header: 'TITLE / DESCRIPTION',
      accessorKey: 'title',
      sortable: true,
      cell: (r) => <span className="font-semibold text-slate-800">{r.title}</span>,
    },
    {
      header: 'LOAD TYPE',
      accessorKey: 'type',
      sortable: true,
      cell: (r) => {
        const isComb = r.isCombination;
        const isSeismic = r.type === 'SEISMIC';
        const isDead = r.type === 'DEAD';
        const isLive = r.type === 'LIVE';

        let badgeStyle = 'bg-slate-100 text-slate-700';
        if (isComb) badgeStyle = 'bg-purple-100 text-purple-800 border-purple-200';
        else if (isSeismic) badgeStyle = 'bg-rose-100 text-rose-800 border-rose-200';
        else if (isDead) badgeStyle = 'bg-slate-100 text-slate-800 border-slate-300';
        else if (isLive) badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badgeStyle}`}>
            {r.isCombination ? 'COMBINATION' : r.type}
          </span>
        );
      },
      width: '140px',
    },
    {
      header: 'COMBINATION FACTORS',
      cell: (r) => {
        const comb = loadCombinations.get(r.id);
        if (!comb || comb.factors.length === 0) {
          return <span className="text-slate-400 font-sans text-xs">Primary Load Case</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {comb.factors.map((f, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] border border-slate-200 font-mono">
                {f.factor} × LC{f.loadCaseId}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const isCombColumns: ColumnDef<StandardLoadCombination>[] = [
    {
      header: 'COMBINATION ID',
      accessorKey: 'id',
      sortable: true,
      cell: (r) => <span className="font-bold text-deep-navy font-mono">COMB-{r.id}</span>,
      width: '130px',
    },
    {
      header: 'NAME / EQUATION',
      accessorKey: 'name',
      cell: (r) => <span className="font-mono font-bold text-secondary-brand">{r.name}</span>,
      width: '210px',
    },
    {
      header: 'LIMIT STATE TYPE',
      accessorKey: 'type',
      cell: (r) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
            r.type === 'STRENGTH' ? 'bg-indigo-100 text-indigo-900' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {r.type}
        </span>
      ),
      width: '140px',
    },
    {
      header: 'GOVERNING DESIGN CRITERIA',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.isGoverningFor?.map((g, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] border border-slate-200">
              {g}
            </span>
          )) || <span className="text-slate-400 font-sans text-xs">General Limit State</span>}
        </div>
      ),
    },
    {
      header: 'IS CODE REFERENCE',
      accessorKey: 'codeReference',
      cell: (r) => <span className="font-mono text-slate-600 text-xs">{r.codeReference}</span>,
      width: '180px',
    },
  ];

  const handleExport = () => {
    if (activeTab === 'STAAD_LOADS') {
      exportToCsv(
        loadCases.map((lc) => ({
          LoadCaseId: lc.id,
          Title: lc.title,
          Type: lc.type,
          IsCombination: lc.isCombination ? 'YES' : 'NO',
        })),
        'Load_Cases_STAAD.csv'
      );
    } else {
      exportToCsv(
        isCombinations.map((c) => ({
          Id: c.id,
          Name: c.name,
          Type: c.type,
          Equation: c.equation,
          CodeReference: c.codeReference,
        })),
        'IS456_IS1893_Load_Combinations.csv'
      );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-hidden font-sans">
      {/* ----------------- LATERAL LOAD COMPLIANCE AUDITOR BANNER ----------------- */}
      <div className="bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-secondary-brand" />
            <h3 className="font-mono text-sm font-bold text-deep-navy">
              STAAD LATERAL LOAD AUDITOR & IS 1893 / IS 875 COMPLIANCE
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
              auditResult.isCompliant
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            {auditResult.isCompliant ? 'LATERAL SEISMIC DETECTED' : 'LATERAL AUDIT WARNING'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          {auditResult.scorecard.map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded border border-ui-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-800">{item.title}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      item.status === 'DETECTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'OPTIONAL'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 block mt-0.5">{item.code}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans mt-2 line-clamp-2" title={item.details}>
                {item.details}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ui-border pb-1">
        <button
          onClick={() => setActiveTab('STAAD_LOADS')}
          className={`px-3 py-1.5 font-mono text-xs rounded border transition-all ${
            activeTab === 'STAAD_LOADS'
              ? 'bg-deep-navy text-white border-deep-navy font-bold shadow-sm'
              : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
          }`}
        >
          STAAD Model Load Cases ({loadCases.length})
        </button>
        <button
          onClick={() => setActiveTab('IS_COMBINATIONS')}
          className={`px-3 py-1.5 font-mono text-xs rounded border transition-all flex items-center gap-1.5 ${
            activeTab === 'IS_COMBINATIONS'
              ? 'bg-deep-navy text-white border-deep-navy font-bold shadow-sm'
              : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>IS 456 & IS 1893 Standard Combination Matrix ({isCombinations.length})</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'STAAD_LOADS' ? (
          <DataTable
            data={loadCases}
            columns={staadColumns}
            title="STAAD LOAD DEFINITIONS & COMBINATIONS"
            searchPlaceholder="Search by load case # or title..."
            searchFilter={(item, q) =>
              String(item.id).includes(q) || item.title.toLowerCase().includes(q)
            }
            onExportCsv={handleExport}
          />
        ) : (
          <DataTable
            data={isCombinations}
            columns={isCombColumns}
            title="INDIAN STANDARD (IS 456 / IS 1893 / IS 875) LOAD COMBINATIONS"
            searchPlaceholder="Search combination name or code..."
            searchFilter={(item, q) =>
              item.name.toLowerCase().includes(q) ||
              item.type.toLowerCase().includes(q) ||
              item.codeReference.toLowerCase().includes(q)
            }
            onExportCsv={handleExport}
          />
        )}
      </div>
    </div>
  );
};
