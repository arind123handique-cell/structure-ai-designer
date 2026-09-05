import React from 'react';

/** Compact dark-etabs form primitives shared by all engineering windows. */

export const WindowSection: React.FC<{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, children, actions }) => (
  <div className="mb-4">
    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{title}</span>
      {actions}
    </div>
    {children}
  </div>
);

export const WindowField: React.FC<{
  label: React.ReactNode;
  unit?: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, unit, children, hint }) => (
  <label className="block mb-2">
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        {unit && (
          <span className="ml-1 text-slate-600 normal-case">({unit})</span>
        )}
      </span>
    </div>
    {children}
    {hint && <span className="text-[9px] text-slate-500">{hint}</span>}
  </label>
);

export const NumField: React.FC<{
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, unit, value, onChange, placeholder, disabled }) => (
  <WindowField label={label} unit={unit}>
    <input
      type="number"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs outline-none focus:border-sky-500 disabled:opacity-40"
    />
  </WindowField>
);

export const TxtField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <WindowField label={label}>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs outline-none focus:border-sky-500"
    />
  </WindowField>
);

export interface SelectOption {
  value: string;
  label: string;
}

export const SelField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}> = ({ label, value, onChange, options, disabled }) => (
  <WindowField label={label}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs outline-none focus:border-sky-500 disabled:opacity-40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </WindowField>
);

export const WindowBtn: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  children: React.ReactNode;
}> = ({ onClick, disabled, variant = 'ghost', children }) => {
  const base =
    'px-3 py-1.5 rounded border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'bg-sky-600 hover:bg-sky-500 border-sky-600 text-white',
    ghost: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200',
    danger: 'bg-red-950 hover:bg-red-900 border-red-700 text-red-200',
    success: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-700 text-white',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
};

export const WindowActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-end gap-2">{children}</div>
);

export const WindowFooterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-between border-t border-slate-700 bg-slate-900 px-3 py-2 shrink-0">
    {children}
  </div>
);

export const WindowAlert: React.FC<{
  tone: 'error' | 'warning' | 'pass' | 'info';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const styles: Record<string, string> = {
    error: 'bg-red-950/60 border-red-800 text-red-200',
    warning: 'bg-amber-950/60 border-amber-800 text-amber-200',
    pass: 'bg-emerald-950/60 border-emerald-800 text-emerald-200',
    info: 'bg-slate-800 border-slate-600 text-slate-300',
  };
  return (
    <div className={`px-2.5 py-1.5 border rounded text-[10px] ${styles[tone]}`}>{children}</div>
  );
};

export type EngineeringStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CALCULATED' | 'NOT_DESIGNED';

export const StatusChip: React.FC<{ status: EngineeringStatus | string; label?: string }> = ({
  status,
  label,
}) => {
  const map: Record<string, string> = {
    PASS: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    WARNING: 'bg-amber-950 text-amber-300 border-amber-700',
    FAIL: 'bg-red-950 text-red-300 border-red-700',
    NOT_CALCULATED: 'bg-slate-800 text-slate-400 border-slate-600',
    NOT_DESIGNED: 'bg-slate-800 text-slate-400 border-slate-600',
    MISSING_DATA: 'bg-orange-950 text-orange-300 border-orange-700',
    INFO: 'bg-sky-950 text-sky-300 border-sky-700',
    CRITICAL: 'bg-red-950 text-red-300 border-red-700',
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide ${map[status] || map.NOT_CALCULATED}`}
    >
      {label || status}
    </span>
  );
};

export const SectionPreview: React.FC<{
  widthMm?: number;
  depthMm?: number;
  diameterMm?: number;
}> = ({ widthMm, depthMm, diameterMm }) => {
  const box = widthMm && depthMm;
  const circle = diameterMm;
  return (
    <div className="flex items-center justify-center py-2 bg-slate-950 border border-slate-700 rounded">
      {box && (
        <div
          className="bg-sky-900 border border-sky-400"
          style={{
            width: Math.min(90, Math.max(24, widthMm / 4)),
            height: Math.min(110, Math.max(28, depthMm / 4)),
          }}
        >
          <div className="w-full h-1/3 bg-slate-800/70 border-b border-sky-700" />
        </div>
      )}
      {circle && (
        <div
          className="rounded-full bg-sky-900 border border-sky-400"
          style={{ width: Math.min(90, Math.max(30, diameterMm / 3)), height: Math.min(90, Math.max(30, diameterMm / 3)) }}
        />
      )}
      {!box && !circle && <span className="text-[10px] text-slate-500">No preview</span>}
    </div>
  );
};