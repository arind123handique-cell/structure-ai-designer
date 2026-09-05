import { create } from 'zustand';

export interface WindowPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInstance {
  instanceId: string;
  windowId: string;
  props?: Record<string, unknown>;
  placement: WindowPlacement;
  zIndex: number;
  minimized: boolean;
  dirty: boolean;
  modal: boolean;
  restoredHeight: number;
}

export const WINDOW_Z_BASE = 60;
export const WINDOW_MIN_WIDTH = 360;
export const WINDOW_MIN_HEIGHT = 260;

let seq = 0;
const nextInstanceId = () =>
  `win_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export interface OpenWindowOptions {
  modal?: boolean;
  x?: number;
  y?: number;
  size?: { width: number; height: number };
}

interface WindowManagerState {
  windows: WindowInstance[];
  openWindow: (
    windowId: string,
    props?: Record<string, unknown>,
    options?: OpenWindowOptions
  ) => string;
  closeWindow: (instanceId: string) => void;
  closeWindowByTitle: (windowId: string) => void;
  closeAllWindows: () => void;
  focusWindow: (instanceId: string) => void;
  moveWindow: (instanceId: string, x: number, y: number) => void;
  resizeWindow: (instanceId: string, width: number, height: number) => void;
  toggleMinimizeWindow: (instanceId: string) => void;
  setWindowDirty: (instanceId: string, dirty: boolean) => void;
}

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],

  openWindow: (windowId, props, options) => {
    const openCount = get().windows.filter((w) => !w.minimized).length;
    const cascade = 26;
    const offset = openCount % 8;
    const width = options?.size?.width ?? 640;
    const height = options?.size?.height ?? 480;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    const x = Math.max(8, Math.min(options?.x ?? 120 + offset * cascade, vw - width - 24));
    const y = Math.max(8, Math.min(options?.y ?? 96 + offset * cascade, vh - height - 24));

    const maxZ = get().windows.reduce((m, w) => Math.max(m, w.zIndex), WINDOW_Z_BASE - 1);
    const instance: WindowInstance = {
      instanceId: nextInstanceId(),
      windowId,
      props,
      placement: { x, y, width, height },
      zIndex: maxZ + 1,
      minimized: false,
      dirty: false,
      modal: options?.modal ?? false,
      restoredHeight: height,
    };

    set((state) => ({ windows: [...state.windows, instance] }));
    return instance.instanceId;
  },

  closeWindow: (instanceId) => {
    set((state) => ({ windows: state.windows.filter((w) => w.instanceId !== instanceId) }));
  },

  closeWindowByTitle: (windowId) => {
    set((state) => ({ windows: state.windows.filter((w) => w.windowId !== windowId) }));
  },

  closeAllWindows: () => set({ windows: [] }),

  focusWindow: (instanceId) => {
    const maxZ = get().windows.reduce((m, w) => Math.max(m, w.zIndex), WINDOW_Z_BASE - 1);
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId ? { ...w, zIndex: maxZ + 1 } : w
      ),
    }));
  },

  moveWindow: (instanceId, x, y) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId ? { ...w, placement: { ...w.placement, x, y } } : w
      ),
    }));
  },

  resizeWindow: (instanceId, width, height) => {
    const cw = Math.max(WINDOW_MIN_WIDTH, width);
    const ch = Math.max(WINDOW_MIN_HEIGHT, height);
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId
          ? {
              ...w,
              placement: { ...w.placement, width: cw, height: ch },
              restoredHeight: ch,
            }
          : w
      ),
    }));
  },

  toggleMinimizeWindow: (instanceId) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId
          ? { ...w, minimized: !w.minimized, restoredHeight: w.placement.height }
          : w
      ),
    }));
  },

  setWindowDirty: (instanceId, dirty) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.instanceId === instanceId ? { ...w, dirty } : w)),
    }));
  },
}));