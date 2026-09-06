import { FemSolver3D, FemSolverOptions, FemAnalysisResult, FemProgressCallback } from './femSolver3D';
import { NormalizedStructuralModel } from '../model/types';

/**
 * Asynchronously runs the 3D Space Frame FEM Direct Stiffness Analysis Pipeline.
 *
 * Yields periodically to the browser event loop so the UI, loading screens, and 60-120 FPS
 * telemetry paint immediately, and reports live progress across calculation stages.
 */
export async function runFemAnalysisAsync(
  model: NormalizedStructuralModel,
  options?: FemSolverOptions,
  onProgress?: FemProgressCallback
): Promise<FemAnalysisResult> {
  // Yield to browser event loop to let UI render the running status and animations
  await new Promise((resolve) => setTimeout(resolve, 20));

  return FemSolver3D.analyzeModelAsync(model, options, onProgress);
}
