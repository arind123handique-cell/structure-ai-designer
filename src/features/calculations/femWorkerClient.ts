import { FemSolver3D, FemSolverOptions, FemAnalysisResult } from './femSolver3D';
import { NormalizedStructuralModel } from '../model/types';

/**
 * Asynchronously runs the 3D Space Frame FEM Direct Stiffness Analysis Pipeline
 * in a dedicated background Web Worker to preserve a buttery-smooth 60–120 FPS UI.
 *
 * Automatically falls back to synchronous execution if Web Workers are not available
 * (e.g. inside Node test environments or unsupported browser contexts).
 */
export async function runFemAnalysisAsync(
  model: NormalizedStructuralModel,
  options?: FemSolverOptions
): Promise<FemAnalysisResult> {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      return await new Promise<FemAnalysisResult>((resolve) => {
        const worker = new Worker(new URL('./femSolver.worker.ts', import.meta.url), {
          type: 'module',
        });

        const timer = setTimeout(() => {
          worker.terminate();
          // Fallback to sync solver if worker times out
          resolve(FemSolver3D.analyzeModel(model, options));
        }, 12000);

        worker.onmessage = (e: MessageEvent<{ success: boolean; result?: FemAnalysisResult; error?: string }>) => {
          clearTimeout(timer);
          worker.terminate();
          if (e.data.success && e.data.result) {
            resolve(e.data.result);
          } else {
            console.warn('FEM Worker returned error, falling back to sync:', e.data.error);
            resolve(FemSolver3D.analyzeModel(model, options));
          }
        };

        worker.onerror = (err) => {
          clearTimeout(timer);
          worker.terminate();
          console.warn('FEM Worker encountered error, falling back to sync:', err);
          resolve(FemSolver3D.analyzeModel(model, options));
        };

        worker.postMessage({ model, options });
      });
    } catch (err) {
      console.warn('Unable to spawn FEM Worker, falling back to sync execution:', err);
    }
  }

  return FemSolver3D.analyzeModel(model, options);
}
