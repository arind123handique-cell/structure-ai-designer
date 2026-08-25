import React from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { Compass, Layers, Building, Box, ShieldCheck, ArrowLeft } from 'lucide-react';

interface Phase2PlaceholderProps {
  moduleName: string;
  codeStandard: string;
  description: string;
  icon?: React.FC<{ className?: string }>;
}

export const Phase2Placeholder: React.FC<Phase2PlaceholderProps> = ({
  moduleName,
  codeStandard,
  description,
  icon: Icon = Compass,
}) => {
  const { setActiveView } = useProjectStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-background font-sans text-center">
      <div className="max-w-md p-8 bg-surface-card rounded-lg border border-ui-border shadow-md space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-secondary-brand flex items-center justify-center">
          <Icon className="w-7 h-7" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-mono text-[10px] rounded uppercase font-bold border border-blue-200">
            {codeStandard} • PHASE 2
          </span>
          <h2 className="font-mono text-base font-bold text-deep-navy mt-2 uppercase">{moduleName}</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        </div>

        <div className="p-3 bg-slate-50 border border-ui-border rounded text-xs font-mono text-slate-700 text-left space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Status:</span>
            <span className="font-bold text-amber-700">NOT IMPLEMENTED (Coming in Phase 2)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Calculation Engine:</span>
            <span className="text-slate-800">Deterministic TypeScript / IS Code</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Output:</span>
            <span className="text-slate-800">Rebar Area, Bar Callouts, SVG Drawings</span>
          </div>
        </div>

        <button
          onClick={() => setActiveView('dashboard')}
          className="flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-mono text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
