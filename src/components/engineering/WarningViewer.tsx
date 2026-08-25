import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { EngineeringWarning, WarningSeverity } from '@/features/warnings/types';
import { AlertCircle, AlertTriangle, Info, Download, ShieldAlert, Filter } from 'lucide-react';
import { exportToCsv } from '@/utils/exportUtils';

export const WarningViewer: React.FC = () => {
  const { activeProject } = useProjectStore();
  const [selectedSeverity, setSelectedSeverity] = useState<WarningSeverity | 'ALL'>('ALL');

  const warnings = activeProject?.warnings || [];

  const filteredWarnings = useMemo(() => {
    if (selectedSeverity === 'ALL') return warnings;
    return warnings.filter((w) => w.severity === selectedSeverity);
  }, [warnings, selectedSeverity]);

  const counts = useMemo(() => ({
    total: warnings.length,
    critical: warnings.filter((w) => w.severity === 'CRITICAL').length,
    warning: warnings.filter((w) => w.severity === 'WARNING').length,
    info: warnings.filter((w) => w.severity === 'INFO').length,
  }), [warnings]);

  const handleExport = () => {
    exportToCsv(
      warnings.map((w) => ({
        Severity: w.severity,
        Category: w.category,
        Element: w.elementRef || 'General',
        Message: w.message,
        Source: w.source,
        RecommendedAction: w.action || '',
      })),
      'STAAD_Analysis_Warnings.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-6 bg-ui-background overflow-y-auto font-sans">
      {/* Header Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            STRUCTURAL ANALYSIS & PARSER WARNINGS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent detection of unassigned properties, incomplete loading records, and response spectrum warnings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {warnings.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Warnings CSV
            </button>
          )}
        </div>
      </div>

      {/* Severity Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setSelectedSeverity('ALL')}
          className={`p-3 rounded-md border text-left transition-all ${
            selectedSeverity === 'ALL'
              ? 'bg-deep-navy text-white border-deep-navy shadow-md'
              : 'bg-surface-card text-slate-700 border-ui-border hover:border-slate-400'
          }`}
        >
          <span className="text-[11px] font-mono block opacity-80 uppercase">Total Logged</span>
          <span className="text-xl font-bold font-mono">{counts.total}</span>
        </button>

        <button
          onClick={() => setSelectedSeverity('CRITICAL')}
          className={`p-3 rounded-md border text-left transition-all ${
            selectedSeverity === 'CRITICAL'
              ? 'bg-red-700 text-white border-red-700 shadow-md'
              : 'bg-surface-card text-slate-700 border-ui-border hover:border-red-300'
          }`}
        >
          <span className="text-[11px] font-mono block text-red-600 font-semibold uppercase flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Critical ({counts.critical})
          </span>
          <span className="text-xl font-bold font-mono text-red-700">{counts.critical}</span>
        </button>

        <button
          onClick={() => setSelectedSeverity('WARNING')}
          className={`p-3 rounded-md border text-left transition-all ${
            selectedSeverity === 'WARNING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-surface-card text-slate-700 border-ui-border hover:border-amber-300'
          }`}
        >
          <span className="text-[11px] font-mono block text-amber-600 font-semibold uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Warning ({counts.warning})
          </span>
          <span className="text-xl font-bold font-mono text-amber-700">{counts.warning}</span>
        </button>

        <button
          onClick={() => setSelectedSeverity('INFO')}
          className={`p-3 rounded-md border text-left transition-all ${
            selectedSeverity === 'INFO'
              ? 'bg-slate-700 text-white border-slate-700 shadow-md'
              : 'bg-surface-card text-slate-700 border-ui-border hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-mono block text-slate-500 font-semibold uppercase flex items-center gap-1">
            <Info className="w-3 h-3" /> Notice / Info ({counts.info})
          </span>
          <span className="text-xl font-bold font-mono text-slate-700">{counts.info}</span>
        </button>
      </div>

      {/* Warnings List */}
      <div className="flex-1 space-y-2">
        {filteredWarnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-surface-card rounded-md border border-ui-border text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              ✓
            </div>
            <h4 className="font-mono text-sm font-semibold text-slate-800">No Warnings In This Category</h4>
            <p className="text-xs text-slate-500 mt-1">All checks passed or no warnings of this severity.</p>
          </div>
        ) : (
          filteredWarnings.map((item, idx) => {
            const isCritical = item.severity === 'CRITICAL';
            const isWarn = item.severity === 'WARNING';

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-md border shadow-sm transition-all flex flex-col md:flex-row items-start justify-between gap-3 bg-white ${
                  isCritical
                    ? 'border-red-300 bg-red-50/20'
                    : isWarn
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-ui-border bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded mt-0.5 ${
                      isCritical
                        ? 'bg-red-100 text-red-700'
                        : isWarn
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isCritical ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          isCritical
                            ? 'bg-red-700 text-white'
                            : isWarn
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {item.category}
                      </span>
                      {item.elementRef && (
                        <span className="text-xs font-mono font-bold text-deep-navy">
                          {item.elementRef}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">{item.message}</p>
                    {item.action && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        <span className="font-semibold text-slate-600">Action:</span> {item.action}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right text-[10px] font-mono text-slate-400 whitespace-nowrap self-end md:self-auto">
                  {item.source}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
