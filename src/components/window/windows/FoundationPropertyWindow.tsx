import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowField,
  SelField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
  WindowAlert,
} from '../WindowUI';

/**
 * FOUNDATION PROPERTY
 *
 * Catalog of foundation support nodes in the model, their pile assignments,
 * and quick navigation into the pile / pile-cap / footing design windows.
 * Foundation member forces are read from the live analysis results.
 */
export const FoundationPropertyWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const projectPileTypes = useProjectStore((s) => s.projectPileTypes);
  const supportPileAssignments = useProjectStore((s) => s.supportPileAssignments);
  const setActiveView = useProjectStore((s) => s.setActiveView);

  const supports = useMemo(
    () =>
      activeModel
        ? Array.from(activeModel.nodes.values())
            .filter((n) => n.isSupport)
            .map((n) => {
              const support = activeModel.supports.get(n.id);
              const reactions = activeModel.reactions
                .filter((r) => r.nodeId === n.id)
                .reduce(
                  (acc, r) => {
                    acc.compression = Math.min(acc.compression, r.fy);
                    acc.uplift = Math.max(acc.uplift, r.fy);
                    return acc;
                  },
                  { compression: Infinity, uplift: -Infinity }
                );
              return { node: n, support, reactions };
            })
        : [],
    [activeModel]
  );

  const assignedCount = Object.keys(supportPileAssignments).length;

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowAlert tone="info">
          Foundation data is derived from the model&apos;s support nodes and the pile-type library.
          Open the dedicated design windows for full IS 2911 / IS 456 checks.
        </WindowAlert>

        <WindowSection title="Support Nodes">
          <span className="text-xs text-slate-300">
            {supports.length} supports · {assignedCount} with pile assignment
          </span>
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-1 pr-2 font-semibold">Node</th>
                <th className="py-1 pr-2 font-semibold">X (m)</th>
                <th className="py-1 pr-2 font-semibold">Z (m)</th>
                <th className="py-1 pr-2 font-semibold">Max Compression (kN)</th>
                <th className="py-1 pr-2 font-semibold">Max Uplift (kN)</th>
                <th className="py-1 pr-2 font-semibold">Pile</th>
              </tr>
            </thead>
            <tbody>
              {supports.map(({ node, reactions }) => (
                <tr key={node.id} className="border-b border-slate-800">
                  <td className="py-1 pr-2 text-slate-200">N{node.id}</td>
                  <td className="py-1 pr-2 text-slate-300">{node.x.toFixed(2)}</td>
                  <td className="py-1 pr-2 text-slate-300">{node.z.toFixed(2)}</td>
                  <td className="py-1 pr-2 text-slate-300">
                    {Number.isFinite(reactions.compression)
                      ? reactions.compression.toFixed(1)
                      : '—'}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">
                    {Number.isFinite(reactions.uplift)
                      ? reactions.uplift.toFixed(1)
                      : '—'}
                  </td>
                  <td className="py-1 pr-2">
                    {supportPileAssignments[node.id] ? (
                      <StatusChip status="PASS" label={supportPileAssignments[node.id]} />
                    ) : (
                      <span className="text-slate-500 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WindowSection>

        <WindowSection title="Pile Type Library">
          {projectPileTypes.length === 0 ? (
            <span className="text-slate-500 text-[10px]">No pile types defined yet.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {projectPileTypes.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] text-sky-200"
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </WindowSection>

        <WindowSection title="Quick Navigation">
          <div className="flex flex-wrap gap-2">
            <WindowBtn
              variant="primary"
              onClick={() => setActiveView('piles-design')}
            >
              Open Pile Design
            </WindowBtn>
            <WindowBtn
              variant="primary"
              onClick={() => setActiveView('pilecaps-design')}
            >
              Open Pile Cap Design
            </WindowBtn>
            <WindowBtn
              variant="primary"
              onClick={() => setActiveView('footings-design')}
            >
              Open Footing Design
            </WindowBtn>
          </div>
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};