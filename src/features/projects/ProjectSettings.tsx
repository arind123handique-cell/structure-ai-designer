import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { DesignParameters, ConcreteGrade, SteelGrade } from '@/types';
import { Save, Check, Settings as SettingsIcon } from 'lucide-react';

export const ProjectSettings: React.FC = () => {
  const { activeProject, updateDesignSettings } = useProjectStore();
  const [saved, setSaved] = useState(false);

  const currentSettings = activeProject?.metadata.designSettings || {
    code: 'IS456_2000',
    concreteGrade: 'M25',
    steelGrade: 'Fe500D',
    shearRebarGrade: 'Fe500D',
    clearCoverBeam: 30,
    clearCoverColumn: 40,
    clearCoverFooting: 50,
    clearCoverSlab: 20,
    clearCoverPile: 60,
    maxAggregateSize: 20,
    seismicZone: 'IV',
    responseReductionFactor: 5,
    importanceFactor: 1.2,
    soilType: 'II_MEDIUM',
    windSpeed: 39,
    windTerrainCategory: 2,
  };

  const [form, setForm] = useState<DesignParameters>(currentSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateDesignSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-ui-background font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
          <div>
            <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-secondary-brand" />
              STRUCTURAL DESIGN & CODE PARAMETERS
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure Indian Standard (IS) design codes and material parameters.
            </p>
          </div>

          {saved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-mono rounded border border-emerald-300">
              <Check className="w-3.5 h-3.5" />
              Settings Saved
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Material Grades */}
          <div className="bg-surface-card p-5 rounded-md border border-ui-border shadow-sm space-y-4">
            <h3 className="font-mono text-xs font-bold text-deep-navy uppercase border-b border-ui-border pb-2">
              1. Material Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  CONCRETE GRADE (fck)
                </label>
                <select
                  value={form.concreteGrade}
                  onChange={(e) => setForm({ ...form, concreteGrade: e.target.value as ConcreteGrade })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded bg-white focus:outline-none focus:border-secondary-brand"
                >
                  <option value="M20">M20 (fck = 20 N/mm²)</option>
                  <option value="M25">M25 (fck = 25 N/mm²)</option>
                  <option value="M30">M30 (fck = 30 N/mm²)</option>
                  <option value="M35">M35 (fck = 35 N/mm²)</option>
                  <option value="M40">M40 (fck = 40 N/mm²)</option>
                  <option value="M50">M50 (fck = 50 N/mm²)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  MAIN REBAR GRADE (fy)
                </label>
                <select
                  value={form.steelGrade}
                  onChange={(e) => setForm({ ...form, steelGrade: e.target.value as SteelGrade })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded bg-white focus:outline-none focus:border-secondary-brand"
                >
                  <option value="Fe415">Fe415 (fy = 415 N/mm²)</option>
                  <option value="Fe500">Fe500 (fy = 500 N/mm²)</option>
                  <option value="Fe500D">Fe500D (High Ductility)</option>
                  <option value="Fe550">Fe550 (fy = 550 N/mm²)</option>
                  <option value="Fe600">Fe600 (fy = 600 N/mm²)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  SHEAR REINFORCEMENT (fyv)
                </label>
                <select
                  value={form.shearRebarGrade}
                  onChange={(e) => setForm({ ...form, shearRebarGrade: e.target.value as SteelGrade })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded bg-white focus:outline-none focus:border-secondary-brand"
                >
                  <option value="Fe415">Fe415 (415 N/mm²)</option>
                  <option value="Fe500D">Fe500D (500 N/mm²)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clear Covers */}
          <div className="bg-surface-card p-5 rounded-md border border-ui-border shadow-sm space-y-4">
            <h3 className="font-mono text-xs font-bold text-deep-navy uppercase border-b border-ui-border pb-2">
              2. Nominal Clear Cover to Reinforcement (mm)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">BEAMS</label>
                <input
                  type="number"
                  value={form.clearCoverBeam}
                  onChange={(e) => setForm({ ...form, clearCoverBeam: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">COLUMNS</label>
                <input
                  type="number"
                  value={form.clearCoverColumn}
                  onChange={(e) => setForm({ ...form, clearCoverColumn: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">SLABS</label>
                <input
                  type="number"
                  value={form.clearCoverSlab}
                  onChange={(e) => setForm({ ...form, clearCoverSlab: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">FOOTINGS</label>
                <input
                  type="number"
                  value={form.clearCoverFooting}
                  onChange={(e) => setForm({ ...form, clearCoverFooting: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">PILES</label>
                <input
                  type="number"
                  value={form.clearCoverPile}
                  onChange={(e) => setForm({ ...form, clearCoverPile: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>
            </div>
          </div>

          {/* Seismic & Wind */}
          <div className="bg-surface-card p-5 rounded-md border border-ui-border shadow-sm space-y-4">
            <h3 className="font-mono text-xs font-bold text-deep-navy uppercase border-b border-ui-border pb-2">
              3. Seismic (IS 1893:2016) & Wind (IS 875 Part 3)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  SEISMIC ZONE
                </label>
                <select
                  value={form.seismicZone}
                  onChange={(e) => setForm({ ...form, seismicZone: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded bg-white focus:outline-none focus:border-secondary-brand"
                >
                  <option value="II">Zone II (Z = 0.10)</option>
                  <option value="III">Zone III (Z = 0.16)</option>
                  <option value="IV">Zone IV (Z = 0.24)</option>
                  <option value="V">Zone V (Z = 0.36)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  SOIL TYPE
                </label>
                <select
                  value={form.soilType}
                  onChange={(e) => setForm({ ...form, soilType: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded bg-white focus:outline-none focus:border-secondary-brand"
                >
                  <option value="I_ROCK">Type I — Rock / Hard Soil</option>
                  <option value="II_MEDIUM">Type II — Medium Soil</option>
                  <option value="III_SOFT">Type III — Soft Soil</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                  BASIC WIND SPEED (Vb m/s)
                </label>
                <input
                  type="number"
                  value={form.windSpeed}
                  onChange={(e) => setForm({ ...form, windSpeed: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow transition-all"
            >
              <Save className="w-4 h-4" />
              Save Design Parameters
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
