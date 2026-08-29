export interface MathExpression {
  symbol: string; // e.g. "d"
  description: string; // e.g. "Effective Depth"
  formula: string; // e.g. "D - clear_cover - phi_bar / 2"
  substitution: string; // e.g. "450 - 30 - 20 / 2"
  result: string; // e.g. "410.0 mm"
  unit?: string;
  codeReference?: string; // e.g. "IS 456:2000 Cl. 26.5.1"
  status?: 'PASS' | 'WARNING' | 'FAIL' | 'INFO';
}

export interface CalculationSection {
  title: string; // e.g. "1. Section Parameters & Effective Depth"
  description?: string;
  steps: MathExpression[];
}

export interface DetailedCalculationReport {
  elementId: number | string;
  elementType: 'BEAM' | 'COLUMN' | 'PILE' | 'PILECAP' | 'FOOTING' | 'GRADEBEAM' | 'SHEARWALL' | 'SLAB' | 'STAIRCASE';
  title: string;
  designCode: string; // e.g. "IS 456:2000 & IS 13920:2016"
  governingLoadCase?: number | string;
  timestamp: string;
  sections: CalculationSection[];
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
  summaryCallout: string;
}
