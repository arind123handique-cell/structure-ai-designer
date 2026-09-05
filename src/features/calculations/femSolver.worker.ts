import { FemSolver3D, FemSolverOptions, FemAnalysisResult } from './femSolver3D';
import { NormalizedStructuralModel } from '../model/types';

self.onmessage = (e: MessageEvent<{ model: NormalizedStructuralModel; options?: FemSolverOptions }>) => {
  try {
    const { model, options } = e.data;
    const result: FemAnalysisResult = FemSolver3D.analyzeModel(model, options);
    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message || String(err) });
  }
};
