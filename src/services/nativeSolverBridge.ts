import { NormalizedStructuralModel } from '@/features/model/types';
import { FemAnalysisResult } from '@/features/calculations/femSolver3D';
import { runFemAnalysisAsync } from '@/features/calculations/femWorkerClient';

export interface NativeSolverStatus {
  isAvailable: boolean;
  engine: 'NATIVE_CPP' | 'WEB_WORKER';
  version: string;
}

/**
 * NativeSolverBridge: Routes 3D FEM Space Frame analysis either to the
 * high-performance native C++ solver executable (`structure-solver.exe`) via desktop IPC,
 * or gracefully falls back to the Web Worker JavaScript solver when running in browser mode.
 */
export class NativeSolverBridge {
  private static cachedStatus: NativeSolverStatus | null = null;

  /**
   * Checks if native C++ desktop solver engine is available.
   */
  public static async getStatus(): Promise<NativeSolverStatus> {
    if (this.cachedStatus) return this.cachedStatus;

    // Check if running inside Electron or Tauri desktop shell with native bridge exposed
    const isDesktop = typeof window !== 'undefined' && Boolean((window as any).__STRUCTURE_AI_DESKTOP__);

    if (isDesktop && (window as any).__STRUCTURE_AI_DESKTOP__?.solveNative) {
      this.cachedStatus = {
        isAvailable: true,
        engine: 'NATIVE_CPP',
        version: '1.0.0 (C++ Space Frame PCG Engine)',
      };
    } else {
      this.cachedStatus = {
        isAvailable: false,
        engine: 'WEB_WORKER',
        version: '1.0.0 (Web Worker Direct Stiffness Solver)',
      };
    }

    return this.cachedStatus;
  }

  /**
   * Executes structural FEM analysis using the optimal available solver.
   * - In Desktop mode: Native C++ out-of-process execution (System RAM, zero JS GC pause).
   * - In Browser mode: Asynchronous Web Worker thread.
   */
  public static async solve(
    model: NormalizedStructuralModel,
    onProgress?: (step: number, pct: number, detail: string) => void
  ): Promise<FemAnalysisResult> {
    const status = await this.getStatus();

    if (status.isAvailable && (window as any).__STRUCTURE_AI_DESKTOP__?.solveNative) {
      onProgress?.(1, 20, 'Invoking Native C++ High-Performance Space Frame Solver...');
      try {
        const payload = this.serializeModel(model);
        const result = await (window as any).__STRUCTURE_AI_DESKTOP__.solveNative(payload);
        onProgress?.(8, 100, 'Native C++ Analysis Complete');
        return result;
      } catch (err) {
        console.warn('Native C++ solver invocation failed, falling back to Web Worker:', err);
      }
    }

    // Fallback: Run async Web Worker solver
    return runFemAnalysisAsync(model, undefined, onProgress);
  }

  /**
   * Prepares compact JSON payload for the native solver.
   */
  private static serializeModel(model: NormalizedStructuralModel): any {
    return {
      nodes: Array.from(model.nodes.values()).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
      })),
      members: Array.from(model.members.values()).map((m) => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        section: {
          area: (m.section.zd || 0.3) * (m.section.yd || 0.45),
          iy: ((m.section.yd || 0.45) * Math.pow(m.section.zd || 0.3, 3)) / 12,
          iz: ((m.section.zd || 0.3) * Math.pow(m.section.yd || 0.45, 3)) / 12,
          e: 2.5e7,
          g: 1.04e7,
        },
      })),
      supports: Array.from(model.supports.values()).map((s) => ({
        nodeId: s.nodeId,
        fixUx: !s.releases?.fx,
        fixUy: !s.releases?.fy,
        fixUz: !s.releases?.fz,
        fixRx: !s.releases?.mx,
        fixRy: !s.releases?.my,
        fixRz: !s.releases?.mz,
      })),
    };
  }
}
