import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useProjectStore } from '@/features/projects/projectStore';

interface Props {
  children: ReactNode;
  viewName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  detailsOpen: boolean;
}

export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      detailsOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ViewErrorBoundary] Error captured in view "${this.props.viewName || 'unknown'}":`, error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: Props): void {
    // Automatically reset error boundary if the active view changes
    if (prevProps.viewName !== this.props.viewName && this.state.hasError) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoDashboard = (): void => {
    this.resetError();
    useProjectStore.getState().setActiveView('dashboard');
  };

  handleCopyDiagnostics = (): void => {
    const { error, errorInfo } = this.state;
    const diagnostics = [
      `=== STRUCTUREAI DIAGNOSTIC REPORT ===`,
      `View: ${this.props.viewName || 'unknown'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${error?.name}: ${error?.message}`,
      `\nStack Trace:\n${error?.stack || 'No stack'}`,
      `\nComponent Stack:\n${errorInfo?.componentStack || 'No component stack'}`,
    ].join('\n');

    navigator.clipboard.writeText(diagnostics).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, copied, detailsOpen } = this.state;
      const viewTitle = this.props.viewName ? `Module: ${this.props.viewName}` : 'Module';

      return (
        <div className="flex-1 w-full h-full flex items-center justify-center p-6 bg-slate-950/90 text-slate-100 font-mono">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-900/60 rounded-xl p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded uppercase tracking-wider">
                    Rendering Interrupted
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{viewTitle}</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Structural View Error</h2>
                <p className="text-xs text-slate-300 mt-1 font-sans">
                  The active module encountered a runtime rendering exception. You can reload this view or navigate back to the dashboard.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg font-mono text-xs text-rose-400 break-all select-all">
              <span className="text-slate-500 select-none">$ </span>
              {error?.name}: {error?.message || 'Unknown render error'}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.resetError}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Module
              </button>

              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Return to Dashboard
              </button>

              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 rounded-lg text-xs transition-colors ml-auto cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Report' : 'Copy Diagnostics'}
              </button>
            </div>

            {/* Collapsible Stack Trace */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                type="button"
                onClick={() => this.setState(s => ({ detailsOpen: !s.detailsOpen }))}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {detailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Technical Stack Trace & Diagnostics</span>
              </button>

              {detailsOpen && (
                <div className="mt-3 max-h-56 overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-800/90 text-[11px] font-mono text-slate-400 space-y-2 select-text">
                  {error?.stack && (
                    <div>
                      <div className="text-slate-500 font-semibold mb-1">Stack:</div>
                      <pre className="whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div className="pt-2 border-t border-slate-900">
                      <div className="text-slate-500 font-semibold mb-1">Component Hierarchy:</div>
                      <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
