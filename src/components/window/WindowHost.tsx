import React, { useEffect } from 'react';
import { useWindowStore } from './WindowStore';
import { WindowSlot } from './WindowRegistry';

/**
 * Global window host. Mounted once at the application root.
 *
 * - Renders each open window via the registry.
 * - Renders a taskbar of minimized windows along the bottom.
 */
export const WindowHost: React.FC = () => {
  const windows = useWindowStore((s) => s.windows);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimizeWindow);
  const focus = useWindowStore((s) => s.focusWindow);
  const deleteWindow = useWindowStore((s) => s.closeWindow);

  // While any modal window is open, block background interaction by
  // overlaying a transparent full-screen layer beneath the modals.
  const hasModal = windows.some((w) => w.modal && !w.minimized);

  useEffect(() => {
    const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 0);
    document.body.classList.toggle('window-drag-active', maxZ > 300);
    return () => document.body.classList.remove('window-drag-active');
  }, [windows]);

  const minimized = windows.filter((w) => w.minimized);

  return (
    <>
      {hasModal && <div className="fixed inset-0 bg-slate-950/60 z-40" />}

      {windows
        .filter((w) => !w.minimized)
        .map((w) => (
          <WindowSlot key={w.instanceId} instance={w} />
        ))}

      {/* Minimized window taskbar */}
      {minimized.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-slate-900 border-t border-slate-700 px-2 py-1 flex items-center gap-1.5 overflow-x-auto">
          {minimized.map((w) => (
            <button
              key={w.instanceId}
              type="button"
              onClick={() => {
                focus(w.instanceId);
                toggleMinimize(w.instanceId);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[10px] font-mono text-slate-200 whitespace-nowrap flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              {w.windowId}
              <span
                role="button"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWindow(w.instanceId);
                }}
                className="ml-1 px-0.5 hover:text-red-400"
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};