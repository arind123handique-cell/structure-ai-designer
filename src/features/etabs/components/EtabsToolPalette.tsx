import React from 'react';
import {
  MousePointer,
  Columns,
  Grid,
  Square,
  PlusCircle,
  Footprints,
  TrendingUp,
  Trash2,
  Layers,
} from 'lucide-react';

export type EtabsDrawTool =
  | 'SELECT'
  | 'QUICK_COLUMN'
  | 'DRAW_BEAM'
  | 'QUICK_BEAM'
  | 'DRAW_SLAB'
  | 'DRAW_WALL'
  | 'DRAW_STAIRCASE'
  | 'ASSIGN_LOAD';

interface EtabsToolPaletteProps {
  activeTool: EtabsDrawTool;
  onSelectTool: (tool: EtabsDrawTool) => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}

export const EtabsToolPalette: React.FC<EtabsToolPaletteProps> = ({
  activeTool,
  onSelectTool,
  onDeleteSelected,
  hasSelection,
}) => {
  const tools: {
    id: EtabsDrawTool;
    label: string;
    icon: React.ReactNode;
    shortcut: string;
    description: string;
  }[] = [
    {
      id: 'SELECT',
      label: 'Select Object',
      icon: <MousePointer className="w-4 h-4" />,
      shortcut: 'Esc',
      description: 'Select nodes, columns, beams, or slabs',
    },
    {
      id: 'QUICK_COLUMN',
      label: 'Quick Column',
      icon: <Columns className="w-4 h-4 text-sky-400" />,
      shortcut: 'C',
      description: 'Click on grid intersection to place RCC Column (450x450)',
    },
    {
      id: 'DRAW_BEAM',
      label: 'Draw Beam',
      icon: <PlusCircle className="w-4 h-4 text-emerald-400" />,
      shortcut: 'B',
      description: 'Click 2 points/nodes to draw framing beam (300x450)',
    },
    {
      id: 'QUICK_BEAM',
      label: 'Quick Beam',
      icon: <Grid className="w-4 h-4 text-indigo-400" />,
      shortcut: 'Q',
      description: 'Click on grid line bay to auto-create beam',
    },
    {
      id: 'DRAW_SLAB',
      label: 'Draw Floor Slab',
      icon: <Square className="w-4 h-4 text-amber-400" />,
      shortcut: 'S',
      description: 'Click 4 grid nodes to define floor slab panel',
    },
    {
      id: 'DRAW_WALL',
      label: 'Draw Shear Wall',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      shortcut: 'W',
      description: 'Draw RCC Shear Wall / Core Shaft (230mm)',
    },
    {
      id: 'DRAW_STAIRCASE',
      label: 'Place Staircase',
      icon: <Footprints className="w-4 h-4 text-orange-400" />,
      shortcut: 'T',
      description: 'Place Dog-Legged RCC Staircase flight module',
    },
    {
      id: 'ASSIGN_LOAD',
      label: 'Assign Load',
      icon: <TrendingUp className="w-4 h-4 text-rose-400" />,
      shortcut: 'L',
      description: 'Assign Wall UDL (kN/m) or Floor Load (kN/m2)',
    },
  ];

  return (
    <div className="w-12 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-2 space-y-1.5 z-20 select-none shadow-md shrink-0">
      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTool(t.id)}
            className={`w-9 h-9 rounded flex items-center justify-center transition-all group relative ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title={`${t.label} (${t.shortcut}) - ${t.description}`}
          >
            {t.icon}
            {/* Tooltip */}
            <div className="absolute left-full ml-2 hidden group-hover:flex flex-col bg-slate-800 text-slate-100 text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none border border-slate-700 font-mono">
              <span className="font-bold text-white flex items-center justify-between gap-2">
                {t.label} <strong className="text-amber-300">[{t.shortcut}]</strong>
              </span>
              <span className="text-slate-400 text-[9px]">{t.description}</span>
            </div>
          </button>
        );
      })}

      <div className="w-6 h-px bg-slate-700 my-1" />

      {/* Delete Selection Tool */}
      <button
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        className={`w-9 h-9 rounded flex items-center justify-center transition-all ${
          hasSelection
            ? 'bg-rose-900/60 text-rose-300 hover:bg-rose-700 hover:text-white border border-rose-600'
            : 'text-slate-600 opacity-40 cursor-not-allowed'
        }`}
        title="Delete Selected Elements (Del)"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};
