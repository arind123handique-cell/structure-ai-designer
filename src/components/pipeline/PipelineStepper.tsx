/**
 * Pipeline Stepper — visual progress through the 6-stage Building Design Pipeline.
 * Uses explicit pipelineStageId store state so stages that share a primary view
 * (Architectural and Detailing both open the architectural plan) stay distinct.
 */
import React from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  PIPELINE_STAGES,
  getStageForView,
  getNextStage,
  getPreviousStage,
} from '@/features/pipeline/pipelineStages';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

export const PipelineStepper: React.FC = React.memo(() => {
  const activeView = useProjectStore((s) => s.activeView);
  const pipelineStageId = useProjectStore((s) => s.pipelineStageId);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const setPipelineStageId = useProjectStore((s) => s.setPipelineStageId);

  // Explicit stage wins; otherwise derive from the active view.
  const viewStage = getStageForView(activeView);
  const currentStage =
    PIPELINE_STAGES.find((s) => s.id === pipelineStageId) ||
    viewStage ||
    null;
  const prevStage = currentStage ? getPreviousStage(currentStage) : null;
  const nextStage = currentStage ? getNextStage(currentStage) : null;

  const goToStage = (stageId: string) => {
    const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    setPipelineStageId(stage.id);
    setActiveView(stage.primaryView);
  };

  return (
    <div className="space-y-1.5">
      {/* Stage dots + labels */}
      <div className="flex items-center justify-between gap-0.5">
        {PIPELINE_STAGES.map((stage) => {
          const active = currentStage?.id === stage.id;
          const done = currentStage ? stage.index < currentStage.index : false;
          return (
            <button
              key={stage.id}
              onClick={() => goToStage(stage.id)}
              title={`${stage.index}. ${stage.title} — ${stage.description}`}
              className="flex-1 flex flex-col items-center gap-0.5 group py-0.5"
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-bold border transition-all ${
                  active
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] ring-1 ring-emerald-400/40'
                    : done
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800 group-hover:border-emerald-600'
                      : 'bg-slate-800 text-slate-500 border-slate-700 group-hover:text-slate-300'
                }`}
              >
                {done ? <Check className="w-2.5 h-2.5" /> : stage.index}
              </span>
              <span className={`text-[7.5px] font-mono leading-tight text-center truncate w-full ${active ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                {stage.shortTitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current stage compact bar + next/prev */}
      {currentStage ? (
        <div className="flex items-center justify-between gap-1 px-1.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 shadow-2xs">
          <button
            onClick={() => prevStage && goToStage(prevStage.id)}
            disabled={!prevStage}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 text-[9.5px] font-mono disabled:opacity-25 disabled:pointer-events-none transition-all shrink-0"
            title={prevStage ? `Previous: Stage ${prevStage.index} · ${prevStage.shortTitle}` : 'First Stage'}
          >
            <ArrowLeft className="w-2.5 h-2.5" />
            <span>Prev</span>
          </button>

          <div
            className="flex items-center gap-1 min-w-0 truncate text-center cursor-default px-1"
            title={`${currentStage.title}: ${currentStage.description}`}
          >
            <span className="text-emerald-400 font-bold text-[9.5px] font-mono shrink-0">S{currentStage.index}</span>
            <span className="text-white font-semibold text-[10.5px] truncate font-mono">{currentStage.title}</span>
          </div>

          <button
            onClick={() => nextStage && goToStage(nextStage.id)}
            disabled={!nextStage}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[9.5px] font-mono font-bold border border-emerald-600/90 disabled:opacity-25 disabled:pointer-events-none transition-all shrink-0 shadow-2xs"
            title={nextStage ? `Next: Stage ${nextStage.index} · ${nextStage.shortTitle}` : 'Final Stage'}
          >
            <span>Next</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <div className="px-2 py-1 rounded bg-slate-800/70 border border-slate-700 text-[10px] text-slate-400 text-center font-mono">
          Stage 1: Plot &amp; Site
        </div>
      )}
    </div>
  );
});
PipelineStepper.displayName = 'PipelineStepper';