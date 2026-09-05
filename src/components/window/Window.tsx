import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { X, Minus } from 'lucide-react';
import { useWindowStore, WindowInstance } from './WindowStore';
import { WINDOW_Z_BASE } from './WindowStore';

export interface WindowContentProps {
  instance: WindowInstance;
  close: () => void;
  setDirty: (dirty: boolean) => void;
}

interface WindowProps {
  instance: WindowInstance;
  title: string;
  categoryLabel: string;
  content: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({ instance, title, categoryLabel, content }) => {
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const toggleMinimizeWindow = useWindowStore((s) => s.toggleMinimizeWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      focusWindow(instance.instanceId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...instance.placement };
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
        moveWindow(instance.instanceId, startPos.x + dx, startPos.y + dy);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      void moved;
    },
    [focusWindow, instance, moveWindow]
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      focusWindow(instance.instanceId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = {
        width: instance.placement.width,
        height: instance.placement.height,
      };

      const onMove = (ev: PointerEvent) => {
        const dw = ev.clientX - startX;
        const dh = ev.clientY - startY;
        resizeWindow(instance.instanceId, startSize.width + dw, startSize.height + dh);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [focusWindow, instance, resizeWindow]
  );

  const handleClose = useCallback(() => {
    if (instance.dirty) {
      const ok = window.confirm('This window has unsaved changes. Discard them and close?');
      if (!ok) return;
    }
    closeWindow(instance.instanceId);
  }, [instance, closeWindow]);

  const handleFocus = useCallback(() => focusWindow(instance.instanceId), [focusWindow, instance]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal={instance.modal}
      aria-label={title}
      tabIndex={-1}
      onPointerDownCapture={handleFocus}
      className="fixed flex flex-col overflow-hidden bg-slate-900 border border-slate-600 rounded-lg shadow-2xl outline-none select-none"
      style={{
        left: instance.placement.x,
        top: instance.placement.y,
        width: instance.placement.width,
        height: instance.minimized ? 34 : instance.placement.height,
        zIndex: Math.max(WINDOW_Z_BASE, instance.zIndex),
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Title bar */}
      <div
        role="button"
        aria-label="Drag window"
        onPointerDown={handleHeaderPointerDown}
        onDoubleClick={() => toggleMinimizeWindow(instance.instanceId)}
        className="h-9 shrink-0 bg-slate-800 border-b border-slate-600 flex items-center px-2 cursor-move"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100 truncate">
          {title}
        </span>
        <span className="ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[9px] font-semibold tracking-wider">
          {categoryLabel}
        </span>
        {instance.dirty && (
          <span className="ml-2 text-[10px] text-amber-400 font-semibold" title="Unsaved changes">
            ● UNSAVED
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => toggleMinimizeWindow(instance.instanceId)}
          className="p-1 rounded hover:bg-slate-600 text-slate-300"
          aria-label="Minimize window"
          tabIndex={0}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded hover:bg-red-700 hover:text-white text-slate-300"
          aria-label="Close window"
          tabIndex={0}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!instance.minimized && (
        <>
          {/* Content body */}
          <div className="flex-1 overflow-auto">{content}</div>

          {/* Resize handle */}
          <div
            role="button"
            aria-label="Resize window"
            onPointerDown={handleResizePointerDown}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
            style={{
              background:
                'linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.5) 50%, rgba(100,116,139,0.5) 58%, transparent 58%)',
            }}
          />
        </>
      )}
    </div>
  );
};