import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'card' | 'plain';
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  defaultOpen = true,
  storageKey,
  open,
  onToggle,
  headerActions,
  children,
  className = '',
  contentClassName = '',
  variant = 'card',
}) => {
  const isControlled = open !== undefined && onToggle !== undefined;
  const [internalOpen, setInternalOpen] = useState(() => {
    if (storageKey) {
      try {
        const v = localStorage.getItem(`cp:${storageKey}`);
        if (v !== null) return v === '1';
      } catch {}
    }
    return defaultOpen;
  });

  const isOpen = isControlled ? open! : internalOpen;

  useEffect(() => {
    if (!isControlled && storageKey) {
      try {
        localStorage.setItem(`cp:${storageKey}`, isOpen ? '1' : '0');
      } catch {}
    }
  }, [isOpen, storageKey, isControlled]);

  const toggle = () => {
    if (isControlled) onToggle!(!isOpen);
    else setInternalOpen(!isOpen);
  };

  const wrapperClass =
    variant === 'card'
      ? `bg-surface-card border border-ui-border rounded-lg shadow-xs ${className}`
      : className;

  return (
    <div className={wrapperClass}>
      <div
        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 ${variant === 'card' ? 'bg-slate-50/70 border-b border-ui-border rounded-t-lg' : ''} ${!isOpen ? 'rounded-b-lg border-b-0' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0">{icon}</span>}
          <h3 className="font-mono text-xs font-bold text-deep-navy tracking-wide truncate">{title}</h3>
          {!isOpen && <span className="text-[10px] font-mono text-slate-400 ml-2">(hidden)</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerActions && isOpen && <div className="flex items-center gap-1.5 mr-1">{headerActions}</div>}
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 hover:text-deep-navy border border-ui-border rounded text-[11px] font-mono shadow-2xs transition-colors"
            title={isOpen ? 'Hide panel' : 'Show panel'}
            aria-label={isOpen ? `Hide ${title}` : `Show ${title}`}
          >
            {isOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOpen ? 'Hide' : 'Show'}</span>
            {isOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>
        </div>
      </div>
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  );
};
