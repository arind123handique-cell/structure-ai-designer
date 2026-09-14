import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { ManualAnalysisEngine, ManualReviewRow } from '@/features/calculations/manualAnalysisEngine';
import { exportToCsv } from '@/utils/exportUtils';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  GitCompare,
  Info,
  ChevronDown,
  ChevronUp,
  Calculator,
  Search,
  Building2,
  Layers,
  Scale,
  SlidersHorizontal,
} from 'lucide-react';

type FilterStatus = 'ALL' | 'MATCH' | 'CLOSE' | 'REVIEW';
type SortKey = 'memberId' | 'primaryDev' | 'anlAxial' | 'anlMoment' | 'status';

const StatusBadge: React.FC<{ status: ManualReviewRow['status'] }> = ({ status }) => {
  const cfg = {
    MATCH: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: <CheckCircle2 className="w-3 h-3" /> },
    CLOSE: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: <AlertTriangle className="w-3 h-3" /> },
    REVIEW: { cls: 'bg-red-100 text-red-800 border-red-300', icon: <XCircle className="w-3 h-3" /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.cls}`}>
      {cfg.icon}
      {status}
    </span>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}> = ({ label, value, sub, color = 'text-slate-800', icon }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs min-w-[140px] flex-1">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">{label}</div>
      {icon && <div className="text-slate-400">{icon}</div>}
    </div>
    <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

export const AnalysisReviewView: React.FC = () => {
  const { activeModel, selectMember, setActiveView } = useProjectStore();

  const [compareMode, setCompareMode] = useState<'GRAVITY_COMBO' | 'MAX_ENVELOPE'>('GRAVITY_COMBO');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'BEAM' | 'COLUMN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('primaryDev');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Fast, zero-RAM manual analysis evaluation
  const analysisSummary = useMemo(() => {
    return ManualAnalysisEngine.computeReview(activeModel, compareMode);
  }, [activeModel, compareMode]);

  const rows = analysisSummary.rows;

  // Filtered and sorted rows
  const displayRows = useMemo(() => {
    let r = rows;
    if (filterStatus !== 'ALL') r = r.filter((x) => x.status === filterStatus);
    if (filterType !== 'ALL') r = r.filter((x) => x.memberType === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(
        (x) =>
          x.memberId.toString().includes(q) ||
          x.section.toLowerCase().includes(q) ||
          x.storeyLevel.toLowerCase().includes(q)
      );
    }

    return [...r].sort((a, b) => {
      let va = 0,
        vb = 0;
      switch (sortKey) {
        case 'memberId':
          va = a.memberId;
          vb = b.memberId;
          break;
        case 'primaryDev':
          va = a.primaryDev;
          vb = b.primaryDev;
          break;
        case 'anlAxial':
          va = a.anlAxial;
          vb = b.anlAxial;
          break;
        case 'anlMoment':
          va = a.anlMoment;
          vb = b.anlMoment;
          break;
        case 'status': {
          const ord = { MATCH: 0, CLOSE: 1, REVIEW: 2 };
          va = ord[a.status];
          vb = ord[b.status];
          break;
        }
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [rows, filterStatus, filterType, searchQuery, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) =>
    sortKey === col ? (
      sortAsc ? (
        <ChevronUp className="w-3 h-3 inline ml-1" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ml-1" />
      )
    ) : null;

  const handleExport = () => {
    exportToCsv(
      displayRows.map((r) => ({
        MemberId: r.memberId,
        Type: r.memberType,
        Section: r.section,
        Length_m: r.length,
        EffectiveSpan_m: r.effectiveSpan,
        Level: r.storeyLevel,
        Tributary_Area_m2: r.tributaryAreaM2,
        Floors_Above: r.floorsAbove,
        STAAD_ANL_Pu_kN: r.anlAxial,
        Manual_Pu_kN: r.manualAxial,
        Axial_Dev_Pct: r.devAxial,
        STAAD_ANL_Shear_Vy_kN: r.anlShear,
        Manual_Shear_Vu_kN: r.manualShear,
        Shear_Dev_Pct: r.devShear,
        STAAD_ANL_Moment_Mz_kNm: r.anlMoment,
        Manual_Moment_Mu_kNm: r.manualMoment,
        Moment_Dev_Pct: r.devMoment,
        Status: r.status,
        Calculation_Method: r.methodNote,
      })),
      'Manual_vs_ANL_Analysis_Review.csv'
    );
  };

  if (!activeModel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 font-mono">
        <GitCompare className="w-12 h-12 text-slate-300" />
        <p className="text-sm font-semibold">No active model loaded.</p>
        <p className="text-xs">Import a STAAD .ANL file first to review analysis comparison.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ui-background overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 font-mono tracking-tight uppercase">
                Analysis Review: Manual Statics vs STAAD .ANL
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                IS 456 / SP 16 VERIFICATION
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Comparing STAAD.Pro finite element results against classical tributary & continuous beam statics
            </p>
          </div>
        </div>

        {/* Mode Selector & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setCompareMode('GRAVITY_COMBO')}
              className={`px-3 py-1 text-xs font-mono rounded-md font-semibold transition-all ${
                compareMode === 'GRAVITY_COMBO'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Factored Gravity (1.5 DL + 1.5 LL)
            </button>
            <button
              onClick={() => setCompareMode('MAX_ENVELOPE')}
              className={`px-3 py-1 text-xs font-mono rounded-md font-semibold transition-all ${
                compareMode === 'MAX_ENVELOPE'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Worst-Case Envelope (All Cases)
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={displayRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md shadow-xs transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0 overflow-x-auto">
        <SummaryCard
          label="Active Load Comparison"
          value={compareMode === 'GRAVITY_COMBO' ? '1.5 DL + 1.5 LL' : 'Envelope (All LC)'}
          sub={analysisSummary.gravityLoadCaseName}
          color="text-indigo-700"
          icon={<SlidersHorizontal className="w-4 h-4 text-indigo-500" />}
        />
        <SummaryCard
          label="✓ Correlation Match"
          value={analysisSummary.matchedCount}
          sub="Variance ≤ 12-15%"
          color="text-emerald-600"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        />
        <SummaryCard
          label="~ Close Variance"
          value={analysisSummary.closeCount}
          sub="Variance 15-30%"
          color="text-amber-600"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        />
        <SummaryCard
          label="⚠ Lateral / Frame Sway"
          value={analysisSummary.reviewCount}
          sub="Variance > 30%"
          color="text-red-600"
          icon={<XCircle className="w-4 h-4 text-red-500" />}
        />
        {analysisSummary.totalAnlBaseReactionKn > 0 && (
          <SummaryCard
            label="Building Gravity Equilibrium"
            value={`${analysisSummary.baseEquilibriumDevPct}% Dev`}
            sub={`Manual: ${analysisSummary.totalManualBaseGravityKn.toLocaleString()} kN | STAAD: ${analysisSummary.totalAnlBaseReactionKn.toLocaleString()} kN`}
            color={analysisSummary.baseEquilibriumDevPct <= 12 ? 'text-emerald-600' : 'text-amber-600'}
            icon={<Scale className="w-4 h-4" />}
          />
        )}
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="flex items-center gap-3 px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 flex-wrap">
        {/* Search input */}
        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Member #, Section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-slate-50/50"
          />
        </div>

        {/* Member Type filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold mr-1">Type:</span>
          {(['ALL', 'COLUMN', 'BEAM'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-colors ${
                filterType === t
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold mr-1">Status:</span>
          {(['ALL', 'MATCH', 'CLOSE', 'REVIEW'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] font-mono text-slate-400">
          Showing <b>{displayRows.length}</b> of {rows.length} elements
        </span>
      </div>

      {/* ── Table Area ── */}
      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono">
          <Calculator className="w-10 h-10 text-slate-300" />
          <p className="text-sm">No member force data found in active model.</p>
          <p className="text-xs">Import a STAAD .ANL file with member design or end forces output.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs font-mono border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-200 shadow-xs">
              <tr>
                <th
                  className="px-3 py-2.5 text-left cursor-pointer hover:bg-slate-800 select-none"
                  onClick={() => handleSort('memberId')}
                >
                  MEMBER <SortIcon col="memberId" />
                </th>
                <th className="px-3 py-2.5 text-left">TYPE</th>
                <th className="px-3 py-2.5 text-left">SECTION</th>
                <th className="px-3 py-2.5 text-center">STOREY LEVEL</th>
                <th className="px-3 py-2.5 text-right">TRIB. AREA / SPAN</th>

                {/* Column Axial Comparison */}
                <th
                  className="px-3 py-2.5 text-right bg-slate-800 border-l border-slate-700 cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('anlAxial')}
                >
                  STAAD ANL Pu<br />
                  <span className="text-[9px] text-slate-400">(kN)</span>
                </th>
                <th className="px-3 py-2.5 text-right bg-indigo-950/60 text-indigo-300">
                  MANUAL Pu<br />
                  <span className="text-[9px] text-indigo-400">Trib. Area (kN)</span>
                </th>

                {/* Beam Moment Comparison */}
                <th
                  className="px-3 py-2.5 text-right bg-slate-800 border-l border-slate-700 cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('anlMoment')}
                >
                  STAAD ANL Mz<br />
                  <span className="text-[9px] text-slate-400">(kNm)</span>
                </th>
                <th className="px-3 py-2.5 text-right bg-indigo-950/60 text-indigo-300">
                  MANUAL Mu<br />
                  <span className="text-[9px] text-indigo-400">wL²/10 (kNm)</span>
                </th>

                {/* Primary Deviation */}
                <th
                  className="px-3 py-2.5 text-right border-l border-slate-700 cursor-pointer hover:bg-slate-800 select-none"
                  onClick={() => handleSort('primaryDev')}
                >
                  DEV % <SortIcon col="primaryDev" />
                </th>

                {/* Status */}
                <th
                  className="px-3 py-2.5 text-center border-l border-slate-700 cursor-pointer hover:bg-slate-800 select-none"
                  onClick={() => handleSort('status')}
                >
                  STATUS <SortIcon col="status" />
                </th>

                <th className="px-3 py-2.5 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const isExpanded = expandedRow === row.memberId;
                const isEven = idx % 2 === 0;
                const rowBg =
                  row.status === 'REVIEW'
                    ? 'bg-red-50/60 hover:bg-red-100/70'
                    : row.status === 'CLOSE'
                    ? 'bg-amber-50/50 hover:bg-amber-100/60'
                    : isEven
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-slate-50/50 hover:bg-slate-100/70';

                return (
                  <React.Fragment key={`rev_row_${row.memberId}`}>
                    <tr
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${rowBg}`}
                      onClick={() => setExpandedRow(isExpanded ? null : row.memberId)}
                    >
                      <td className="px-3 py-2 font-bold text-indigo-600">#{row.memberId}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.memberType === 'COLUMN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {row.memberType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[130px] truncate">{row.section}</td>
                      <td className="px-3 py-2 text-center text-slate-600 font-semibold">{row.storeyLevel}</td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {row.memberType === 'COLUMN' ? (
                          `${row.tributaryAreaM2} m² (${row.floorsAbove} flrs)`
                        ) : row.isSegmented ? (
                          <span title={`Mesh segment of length ${row.length}m inside ${row.effectiveSpan}m span`}>
                            {row.length}m <span className="text-[10px] text-slate-400">({row.effectiveSpan}m bay)</span>
                          </span>
                        ) : (
                          `${row.length} m`
                        )}
                      </td>

                      {/* Column Axial Comparison */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 border-l border-slate-100">
                        {row.memberType === 'COLUMN' ? row.anlAxial.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-indigo-700 bg-indigo-50/30">
                        {row.memberType === 'COLUMN' ? row.manualAxial.toFixed(1) : '—'}
                      </td>

                      {/* Beam Moment Comparison */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 border-l border-slate-100">
                        {row.memberType === 'BEAM' ? row.anlMoment.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-indigo-700 bg-indigo-50/30">
                        {row.memberType === 'BEAM' ? row.manualMoment.toFixed(1) : '—'}
                      </td>

                      {/* Primary Dev % */}
                      <td className="px-3 py-2 text-right border-l border-slate-100">
                        <span
                          className={`font-bold ${
                            row.primaryDev <= 12
                              ? 'text-emerald-600'
                              : row.primaryDev <= 25
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {row.primaryDev.toFixed(1)}%
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2 text-center border-l border-slate-100">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Inspect Action */}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectMember(row.memberId);
                            setActiveView('3d-model');
                          }}
                          className="px-2 py-0.5 text-[10px] bg-white hover:bg-slate-100 border border-slate-200 rounded font-mono text-slate-700 shadow-2xs"
                        >
                          Inspect 3D
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <tr className="bg-indigo-50/60 border-b border-indigo-200">
                        <td colSpan={12} className="px-6 py-3.5">
                          <div className="flex flex-wrap items-start gap-8 text-[11px] font-mono">
                            <div className="space-y-1">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Manual Engineering Calculation Method:</span>
                              </div>
                              <div className="text-slate-600 bg-white/80 p-2 rounded border border-indigo-100 font-semibold">
                                {row.methodNote}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Member #{row.memberId} · {row.section} · Length: {row.length}m · Storey: {row.storeyLevel}
                              </div>
                            </div>

                            {row.memberType === 'COLUMN' ? (
                              <div className="space-y-1">
                                <div className="font-bold text-slate-800">Axial Load Breakdown</div>
                                <div className="text-slate-600">
                                  Column Tributary Area: <b>{row.tributaryAreaM2} m²</b>
                                </div>
                                <div className="text-slate-600">
                                  Real Floors Supported: <b>{row.floorsAbove}</b>
                                </div>
                                <div className="text-slate-600">
                                  STAAD ANL Pu: <b>{row.anlAxial} kN</b>
                                </div>
                                <div className="text-indigo-700 font-bold">
                                  Manual Pu: <b>{row.manualAxial} kN</b>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="font-bold text-slate-800">Flexure & Shear Breakdown</div>
                                <div className="text-slate-600">
                                  Factored Gravity UDL: <b>{row.manualUDLKnM} kN/m</b>
                                </div>
                                <div className="text-slate-600">
                                  Effective Span: <b>{row.effectiveSpan} m</b> {row.isSegmented ? '(continuous bay)' : ''}
                                </div>
                                <div className="text-slate-600">
                                  STAAD Mz: <b>{row.anlMoment} kNm</b> | Manual Mu: <b>{row.manualMoment} kNm</b>
                                </div>
                                <div className="text-slate-600">
                                  STAAD Vy: <b>{row.anlShear} kN</b> | Manual Vu: <b>{row.manualShear} kN</b>
                                </div>
                              </div>
                            )}

                            <div className="ml-auto max-w-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={row.status} />
                                <span className="font-bold text-slate-700">Variance: {row.primaryDev}%</span>
                              </div>
                              <p className="text-[10px] text-slate-500">
                                {row.status === 'MATCH'
                                  ? 'Strong correlation. STAAD finite element 3D distribution matches classical tributary hand checks.'
                                  : row.status === 'CLOSE'
                                  ? 'Acceptable variance due to 3D space-frame joint stiffness redistribution vs 2D hand statics.'
                                  : 'Higher variance. Often caused by lateral wind/seismic frame sway moments or irregular cantilever framing.'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 shrink-0 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            STAAD ANL values are extracted from the .ANL file. Manual values follow IS 456 / SP 16 tributary area and span statics.
          </span>
        </div>
        <span className="text-slate-400">StructureAI Designer · Verification Module</span>
      </div>
    </div>
  );
};
