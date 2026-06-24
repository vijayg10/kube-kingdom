import { create } from 'zustand';
import type { LogsPayload, DescribePayload } from '../types/cluster';

export type SelectionKind = 'pod' | 'node' | 'service' | 'namespace' | 'secret';

export interface Selection {
  kind: SelectionKind;
  id: string; // pod uid / node name / service uid / namespace name
}

export type ConnectionStatus =
  | 'idle' // on landing screen
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type AppView = 'landing' | 'city';

export interface ContextMenuState {
  /** Screen position in pixels. */
  x: number;
  y: number;
  target: Selection;
}

export interface Toast {
  message: string;
  success: boolean;
}

/**
 * UI-only state: which view we're on, the current selection, detail-panel
 * state, and the camera target a minimap click requests. Updates here are
 * driven by user interaction, not WebSocket events.
 */
interface UiStore {
  view: AppView;
  connection: ConnectionStatus;
  connectionError: string | null;
  readOnly: boolean;

  selection: Selection | null;
  /** Multiple selection ids from a box-select (Tier 1 US2). */
  multiSelection: Selection[];
  detailExpanded: boolean;

  /** World-space [x, z] the camera should fly to (e.g. minimap click). */
  cameraTarget: [number, number] | null;

  contextMenu: ContextMenuState | null;
  logsPanel: LogsPayload | null;
  describePanel: DescribePayload | null;
  toast: Toast | null;

  setView: (view: AppView) => void;
  setConnection: (status: ConnectionStatus, error?: string | null) => void;
  setReadOnly: (readOnly: boolean) => void;
  select: (selection: Selection | null) => void;
  setMultiSelection: (selections: Selection[]) => void;
  toggleDetailExpanded: () => void;
  closeDetail: () => void;
  setCameraTarget: (target: [number, number] | null) => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  setLogsPanel: (payload: LogsPayload) => void;
  closeLogsPanel: () => void;
  setDescribePanel: (payload: DescribePayload) => void;
  closeDescribePanel: () => void;
  showToast: (message: string, success: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  view: 'landing',
  connection: 'idle',
  connectionError: null,
  readOnly: true,

  selection: null,
  multiSelection: [],
  detailExpanded: false,

  cameraTarget: null,
  contextMenu: null,
  logsPanel: null,
  describePanel: null,
  toast: null,

  setView: (view) => set({ view }),
  setConnection: (status, error = null) =>
    set({ connection: status, connectionError: error }),
  setReadOnly: (readOnly) => set({ readOnly }),
  select: (selection) => set({ selection, multiSelection: [], detailExpanded: false }),
  setMultiSelection: (multiSelection) => set({ multiSelection, selection: null }),
  toggleDetailExpanded: () => set((s) => ({ detailExpanded: !s.detailExpanded })),
  closeDetail: () => set({ selection: null, multiSelection: [], detailExpanded: false }),
  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
  openContextMenu: (contextMenu) => set({ contextMenu }),
  closeContextMenu: () => set({ contextMenu: null }),
  setLogsPanel: (logsPanel) => set({ logsPanel }),
  closeLogsPanel: () => set({ logsPanel: null }),
  setDescribePanel: (describePanel) => set({ describePanel }),
  closeDescribePanel: () => set({ describePanel: null }),
  showToast: (message, success) => {
    set({ toast: { message, success } });
    setTimeout(() => set({ toast: null }), 3500);
  },
}));
