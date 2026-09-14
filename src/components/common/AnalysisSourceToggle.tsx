import React from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DesignAnalysisSource } from '@/features/projects/types';
import { FileCode, Calculator, Globe, Check } from 'lucide-react';

interface AnalysisSourceToggleProps {
  section: string; // 'beams' | 'columns' | 'footings' | 'pilecaps' | 'gradebeams'
  sectionLabel?: string; // e.g. 'Beam', 'Column', 'Footing'
  onSourceChange?: (source: DesignAnalysisSource) => void;
  className?: string;
  compact?: boolean;
}

export const AnalysisSourceToggle: React.FC<AnalysisSourceToggleProps> = ({
  section,
  sectionLabel,
  onSourceChange,
  className = '',
  compact = false,
}) => {
  const {
    getSectionAnalysisSource,
    setSectionAnalysisSource,
    setDesignAnalysisSource,
  } = useProjectStore();

  const currentSource = getSectionAnalysisSource(section);
  const [applyGlobally, setApplyGlobally] = React.useState<boolean>(false);

  const handleSelect = (source: DesignAnalysisSource) => {
    if (source === currentSource) return;

    if (applyGlobally) {
      setDesignAnalysisSource(source);
    } else {
      setSectionAnalysisSource(section, source);
    }

    if (onSourceChange) {
      onSourceChange(source);
    }
  };

  const label = sectionLabel || section.charAt(0).toUpperCase() + section.slice(1);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono ${className}`}>
        <span className="text-[10px] text-slate-500 font-semibold px-1 uppercase tracking-wider">
          Source:
        </span>
        <button
          type="button"
          onClick={() => handleSelect('ANL_FILE')}
          title="Use finite element results parsed from the STAAD.Pro .ANL file"
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
            currentSource === 'ANL_FILE'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>STAAD .ANL</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('MANUAL')}
          title="Use IS 456 / SP 16 tributary area and manual static equilibrium calculations"
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
            currentSource === 'MANUAL'
              ? 'bg-emerald-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Manual Statics</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-2xs font-mono text-xs ${className}`}>
      <div className="flex items-center gap-1 text-slate-600 px-1 font-semibold text-[11px] uppercase tracking-wider">
        <span>Force Source ({label}):</span>
      </div>

      <div className="inline-flex items-center bg-white p-0.5 rounded-md border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => handleSelect('ANL_FILE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs ${
            currentSource === 'ANL_FILE'
              ? 'bg-sky-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Use FEA member end forces, joint reactions & envelope combinations from STAAD.Pro ANL output"
        >
          <FileCode className={`w-3.5 h-3.5 ${currentSource === 'ANL_FILE' ? 'text-white' : 'text-sky-600'}`} />
          <span>📁 STAAD .ANL File</span>
          {currentSource === 'ANL_FILE' && <Check className="w-3.5 h-3.5 ml-0.5 text-sky-200" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelect('MANUAL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs ${
            currentSource === 'MANUAL'
              ? 'bg-emerald-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Use IS 456 Tributary Area method, beam continuity statics (IS 456 Table 12), and hand calculations"
        >
          <Calculator className={`w-3.5 h-3.5 ${currentSource === 'MANUAL' ? 'text-white' : 'text-emerald-600'}`} />
          <span>📐 Manual Statics Check</span>
          {currentSource === 'MANUAL' && <Check className="w-3.5 h-3.5 ml-0.5 text-emerald-200" />}
        </button>
      </div>

      <label
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer ml-1 select-none"
        title="When checked, toggling will apply this analysis source to all design modules (Beams, Columns, Footings, Pile Caps, Grade Beams)"
      >
        <input
          type="checkbox"
          checked={applyGlobally}
          onChange={(e) => setApplyGlobally(e.target.checked)}
          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
        />
        <Globe className="w-3 h-3 text-slate-400" />
        <span>Apply to all sections</span>
      </label>
    </div>
  );
};
