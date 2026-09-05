import React from 'react';
import { ConceptColorMode, SectionLegendItem, StoryLegendItem, MaterialLegendItem } from './Structural3DTypes';
import { Layers, Activity, Palette, Flame } from 'lucide-react';

interface Structural3DLegendsProps {
  conceptColor: ConceptColorMode;
  sectionLegends: SectionLegendItem[];
  storyLegends: StoryLegendItem[];
  materialLegends: MaterialLegendItem[];
}

export const Structural3DLegends: React.FC<Structural3DLegendsProps> = ({
  conceptColor,
  sectionLegends,
  storyLegends,
  materialLegends,
}) => {
  if (conceptColor === 'TYPE') return null;

  return (
    <div className="absolute bottom-16 left-4 z-20 max-w-xs font-mono text-xs pointer-events-auto">
      {/* Section Size Concept Legend */}
      {conceptColor === 'SECTION' && sectionLegends.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-slate-300 font-bold">
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>Section Profiles ({sectionLegends.length})</span>
          </div>
          <div className="space-y-1.5">
            {sectionLegends.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 shadow-xs border border-white/20"
                    style={{ backgroundColor: item.colorHex }}
                  />
                  <span className="text-slate-200 font-medium truncate max-w-[140px]">{item.name}</span>
                </div>
                <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                  {item.count} {item.count === 1 ? 'elem' : 'elems'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Story / Level Elevation Concept Legend */}
      {conceptColor === 'STORY' && storyLegends.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-slate-300 font-bold">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Storey Elevation Levels</span>
          </div>
          <div className="space-y-1.5">
            {storyLegends.map((item) => (
              <div key={item.elevationY} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 shadow-xs border border-white/20"
                    style={{ backgroundColor: item.colorHex }}
                  />
                  <span className="text-slate-200 font-medium">{item.label}</span>
                </div>
                <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                  +{item.elevationY.toFixed(1)}m ({item.memberCount})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material Grade Legend */}
      {conceptColor === 'MATERIAL' && materialLegends.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-slate-300 font-bold">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Concrete & Steel Grades</span>
          </div>
          <div className="space-y-1.5">
            {materialLegends.map((item) => (
              <div key={item.materialName} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 shadow-xs border border-white/20"
                    style={{ backgroundColor: item.colorHex }}
                  />
                  <span className="text-slate-200 font-medium">{item.materialName}</span>
                </div>
                <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                  {item.count} elems
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilization / Stress Heatmap Legend (IS 456 / IS 13920) */}
      {conceptColor === 'UTILIZATION' && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>IS 456 Capacity DCR</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Demand / Capacity</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>&lt; 0.50</span>
              </span>
              <span className="text-slate-400">Conservative / Safe</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-lime-400">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-500" />
                <span>0.50 – 0.75</span>
              </span>
              <span className="text-slate-400">Optimal Design</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>0.75 – 0.90</span>
              </span>
              <span className="text-slate-400">Moderate Capacity</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-orange-400">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span>0.90 – 1.00</span>
              </span>
              <span className="text-slate-400">Near Limit</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                <span>&gt; 1.00</span>
              </span>
              <span className="text-rose-400 font-semibold">Overstressed / Fail</span>
            </div>
          </div>

          {/* Gradient Visual Bar */}
          <div className="mt-2.5 h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 via-orange-500 to-rose-600 shadow-inner" />
        </div>
      )}

      {/* Cyberpunk Mode Notice */}
      {conceptColor === 'CYBERPUNK' && (
        <div className="bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 rounded-lg p-2.5 shadow-xl text-[11px] text-cyan-300">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Cyberpunk Neon Hologram Active</span>
          </div>
          <span className="text-slate-400 text-[10px]">
            Glowing Cyan (Columns) • Magenta (Beams) • Violet (Plates)
          </span>
        </div>
      )}
    </div>
  );
};
