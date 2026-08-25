import { EngineeringWarning, WarningSeverity, WarningCategory } from './types';

export class WarningEngine {
  private warnings: EngineeringWarning[] = [];

  public clear(): void {
    this.warnings = [];
  }

  public add(warning: Omit<EngineeringWarning, 'id'>): EngineeringWarning {
    const fullWarning: EngineeringWarning = {
      ...warning,
      id: `warn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };
    this.warnings.push(fullWarning);
    return fullWarning;
  }

  public addParserWarning(elementRef: string | undefined, message: string, action?: string): EngineeringWarning {
    return this.add({
      severity: 'WARNING',
      category: 'PARSER',
      elementRef,
      message,
      source: 'ANL Parser',
      action,
    });
  }

  public addAnalysisWarning(elementRef: string | undefined, message: string, action?: string): EngineeringWarning {
    return this.add({
      severity: 'WARNING',
      category: 'ANALYSIS',
      elementRef,
      message,
      source: 'STAAD Analysis Output',
      action,
    });
  }

  public addCritical(category: WarningCategory, elementRef: string | undefined, message: string, action?: string): EngineeringWarning {
    return this.add({
      severity: 'CRITICAL',
      category,
      elementRef,
      message,
      source: 'Engineering Validation',
      action,
    });
  }

  public getAll(): EngineeringWarning[] {
    return [...this.warnings];
  }

  public getBySeverity(severity: WarningSeverity): EngineeringWarning[] {
    return this.warnings.filter((w) => w.severity === severity);
  }

  public getByCategory(category: WarningCategory): EngineeringWarning[] {
    return this.warnings.filter((w) => w.category === category);
  }

  public getCounts(): { total: number; critical: number; warning: number; info: number } {
    return {
      total: this.warnings.length,
      critical: this.warnings.filter((w) => w.severity === 'CRITICAL').length,
      warning: this.warnings.filter((w) => w.severity === 'WARNING').length,
      info: this.warnings.filter((w) => w.severity === 'INFO').length,
    };
  }
}

export const globalWarningEngine = new WarningEngine();
