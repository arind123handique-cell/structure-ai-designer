import React from 'react';
import { DetailedCalculationReport } from './types';
import { X, Printer, CheckCircle2, AlertTriangle, XCircle, FileText, Compass, Layers } from 'lucide-react';

interface CalculationModalProps {
  report: DetailedCalculationReport | null;
  onClose: () => void;
}

export const CalculationModal: React.FC<CalculationModalProps> = ({ report, onClose }) => {
  if (!report) return null;

  const isPass = report.overallStatus === 'PASS';
  const isWarn = report.overallStatus === 'WARNING';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded ${
                report.elementType === 'COLUMN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-sky-100 text-sky-800'
              }`}
            >
              {report.elementType === 'COLUMN' ? <Layers className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy">{report.title}</h3>
              <p className="text-xs text-slate-500 font-mono">
                Standard: {report.designCode} • Governing LC: #{report.governingLoadCase}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-100 border border-ui-border rounded transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Sheet
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calculation Sheet Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-sans">
          {/* Summary Banner */}
          <div
            className={`p-4 rounded-md border flex items-center justify-between ${
              isPass
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : isWarn
                ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                : 'bg-red-50/70 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center gap-3">
              {isPass ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : isWarn ? (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider block">
                  DESIGN STATUS: {report.overallStatus}
                </span>
                <span className="font-mono text-xs text-slate-700 font-semibold">{report.summaryCallout}</span>
              </div>
            </div>

            <span className="px-3 py-1 bg-white font-mono text-xs font-bold rounded border shadow-sm">
              {report.designCode}
            </span>
          </div>

          {/* Step-by-Step Sections */}
          <div className="space-y-6">
            {report.sections.map((section, sIdx) => (
              <div key={sIdx} className="bg-slate-50/80 border border-ui-border rounded-lg p-4 space-y-3">
                <h4 className="font-mono text-xs font-bold text-deep-navy uppercase border-b border-slate-200 pb-2">
                  {section.title}
                </h4>

                <div className="divide-y divide-slate-200">
                  {section.steps.map((step, stepIdx) => (
                    <div key={stepIdx} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 text-xs">{step.symbol}</span>
                          <span className="text-slate-600 font-medium text-xs">• {step.description}</span>
                          {step.codeReference && (
                            <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                              {step.codeReference}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          <span>Formula: </span>
                          <code className="text-slate-700 font-semibold">{step.formula}</code>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          <span>Substitution: </span>
                          <code className="text-slate-600">{step.substitution}</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-ui-border shadow-xs text-xs">
                          {step.result}
                        </span>
                        {step.status && step.status !== 'INFO' && (
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                              step.status === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {step.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between text-xs font-mono text-slate-500">
          <span>Structure AI Designer • Deterministic IS Code Calculation Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-deep-navy hover:bg-slate-800 text-white rounded font-semibold transition-colors"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
};
