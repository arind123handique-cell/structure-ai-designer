export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type WarningCategory = 'PARSER' | 'ANALYSIS' | 'INPUT' | 'MODEL' | 'CODE' | 'GEOTECHNICAL';

export interface EngineeringWarning {
  id: string;
  severity: WarningSeverity;
  category: WarningCategory;
  elementRef?: string; // e.g. "Member #3", "Joint #12", "Load #5"
  message: string;
  source: string; // e.g. "ANL Parser", "IS 1893 Check", "Story Drift"
  action?: string; // Recommended engineering action
  timestamp?: number;
}
