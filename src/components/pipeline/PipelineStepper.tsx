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
    <div className="space-y-2">
      {/* Stage dots + labels */}
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STAGES.map((stage) => {
          const active = currentStage?.id === stage.id;
          const done = currentStage ? stage.index < currentStage.index : false;
          return (
            <button
              key={stage.id}
              onClick={() => goToStage(stage.id)}
              title={`${stage.index}. ${stage.title} — ${stage.description}`}
              className={`flex-1 flex flex-col items-center gap-1 group`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                  active
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : done
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800 group-hover:border-emerald-600'
                      : 'bg-slate-800 text-slate-500 border-slate-700 group-hover:text-slate-300'
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : stage.index}
              </span>
              <span className={`text-[8px] font-mono leading-tight text-center ${active ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                {stage.shortTitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current stage description + next/prev */}
      {currentStage ? (
        <div className="px-2 py-1.5 rounded bg-slate-800/70 border border-slate-700">
          <div className="text-[10px] text-slate-300">
            <span className="text-emerald-400 font-bold">STAGE {currentStage.index}/6</span>{' '}
            <span className="font-bold text-white">{currentStage.title}</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">{currentStage.description}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={() => prevStage && goToStage(prevStage.id)}
              disabled={!prevStage}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-[10px] font-mono disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button
              onClick={() => nextStage && goToStage(nextStage.id)}
              disabled={!nextStage}
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-mono font-bold border border-emerald-600 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Next: {nextStage?.shortTitle || '—'} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-2 py-1.5 rounded bg-slate-800/70 border border-slate-700 text-[10px] text-slate-400">
          Guided pipeline: start with <strong className="text-emerald-400">Stage 1 — Plot &amp; Site</strong>
        </div>
      )}
    </div>
  );
});
PipelineStepper.displayName = 'PipelineStepper';