/**
 * Site & 3D Model Split View — Stage 1 + Stage 3 side-by-side.
 *
 * Left:  PlotAreaView (plot boundary, setbacks, footprint)
 * Right: Structural3DViewer (3D structural model with selection, rebar, etc.)
 *
 * Mirrors the architectural plan's "2D / 3D Split" pattern. The 3D viewer's
 * inspector panel and selection-driven member-details drawer remain available.
 */
import React, { useState, useEffect } from 'react';
import { Map, Box, GripVertical, Maximize2, Minimize2, Compass } from 'lucide-react';
import { useProjectStore } from '@/features/projects/projectStore';
import { PlotAreaView } from './PlotAreaView';
import { Structural3DViewer } from '@/components/model-viewer/Structural3DViewer';

export const SiteAnd3DView: React.FC = () => {
  const [splitPct, setSplitPct] = useState<number>(50);
  const [isFullscreen, setIsFullscreen] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const activeModel = useProjectStore((s) => s.activeModel);
  const fitSitePlanToModel = useProjectStore((s) => (s as any).fitSitePlanToModel);
  const moveModelToSitePlan = useProjectStore((s) => (s as any).moveModelToSitePlan);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (x / rect.width) * 100));
      setSplitPct(pct);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const leftWidth = isFullscreen === 'left' ? '100%' : isFullscreen === 'right' ? '0%' : `${splitPct}%`;
  const rightWidth = isFullscreen === 'right' ? '100%' : isFullscreen === 'left' ? '0%' : `${100 - splitPct}%`;

  return (
    <div ref={containerRef} className="flex-1 flex h-full w-full overflow-hidden bg-slate-950 relative">
      <div
        className="h-full flex flex-col border-r border-slate-800 relative min-w-0"
        style={{ width: leftWidth, transition: isDragging ? 'none' : 'width 200ms ease' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-200">
            <Map className="w-3.5 h-3.5 text-emerald-400" />
            <span>SITE PLAN</span>
            <span className="text-slate-500 text-[10px] font-normal">— plot, setbacks, footprint</span>
          </div>
          <button
            onClick={() => setIsFullscreen(isFullscreen === 'left' ? null : 'left')}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title={isFullscreen === 'left' ? 'Restore split' : 'Maximize site plan'}
          >
            {isFullscreen === 'left' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PlotAreaView />
        </div>
      </div>

      {!isFullscreen && (
        <div
          onMouseDown={() => setIsDragging(true)}
          className={`w-1.5 h-full cursor-col-resize shrink-0 flex items-center justify-center group relative z-10 ${
            isDragging ? 'bg-indigo-500/40' : 'bg-slate-800/60 hover:bg-indigo-500/30'
          } transition-colors`}
          title="Drag to resize"
        >
          <GripVertical className="w-3 h-3 text-slate-500 group-hover:text-indigo-300" />
        </div>
      )}

      <div
        className="h-full flex flex-col relative min-w-0"
        style={{ width: rightWidth, transition: isDragging ? 'none' : 'width 200ms ease' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-200">
            <Box className="w-3.5 h-3.5 text-sky-400" />
            <span>3D STRUCTURAL MODEL</span>
            <span className="text-slate-500 text-[10px] font-normal">— click a member to inspect</span>
          </div>
          <div className="flex items-center gap-1.5">
            {activeModel && activeModel.nodes.size > 0 && (
              <>
                <button
                  onClick={async () => { await fitSitePlanToModel(); }}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-mono font-bold flex items-center gap-1 transition-colors shadow-xs"
                  title="Fit Site Plan around 3D building model"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Fit Site</span>
                </button>
                <button
                  onClick={async () => { await moveModelToSitePlan(); }}
                  className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-bold flex items-center gap-1 transition-colors shadow-xs"
                  title="Move 3D building inside Site Plan footprint"
                >
                  <Compass className="w-3 h-3" />
                  <span>Move to Site</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsFullscreen(isFullscreen === 'right' ? null : 'right')}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors ml-1"
              title={isFullscreen === 'right' ? 'Restore split' : 'Maximize 3D model'}
            >
              {isFullscreen === 'right' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Structural3DViewer />
        </div>
      </div>
    </div>
  );
};
