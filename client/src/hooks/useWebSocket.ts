import { useCallback, useEffect, useRef } from 'react';
import type { ClientMessage, ServerMessage } from '../types/cluster';
import { useClusterStore } from '../store/clusterStore';
import { useUiStore } from '../store/uiStore';
import { registerSender } from './wsClient';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]; // research.md §3 reconnect policy

export type ConnectIntent =
  | { kind: 'mock' }
  | { kind: 'cluster'; kubeconfig: string };

/**
 * Manages the single WebSocket connection for the session: connect on intent,
 * dispatch server messages into the stores, and reconnect with exponential
 * backoff (1s→16s, 5 attempts) before surfacing an error state.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const intentRef = useRef<ConnectIntent | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualClose = useRef(false);

  const dispatch = useCallback((msg: ServerMessage) => {
    const cluster = useClusterStore.getState();
    switch (msg.type) {
      case 'CLUSTER_SNAPSHOT':
        cluster.applySnapshot(msg.payload);
        break;
      case 'POD_UPDATED':
        cluster.upsertPod(msg.payload);
        break;
      case 'POD_DELETED':
        cluster.deletePod(msg.payload.uid);
        break;
      case 'NODE_UPDATED':
        cluster.upsertNode(msg.payload);
        break;
      case 'NAMESPACE_UPDATED':
        cluster.upsertNamespace(msg.payload);
        break;
      case 'NAMESPACE_DELETED':
        cluster.deleteNamespace(msg.payload.name);
        break;
      case 'SERVICE_UPDATED':
        cluster.upsertService(msg.payload);
        break;
      case 'DEPLOYMENT_UPDATED':
        cluster.upsertDeployment(msg.payload);
        break;
      case 'SUMMARY_UPDATED':
        cluster.setSummary(msg.payload);
        break;
      case 'TRAFFIC_EVENT':
        cluster.setTraffic(msg.payload);
        break;
      case 'SERVER_CONFIG':
        useUiStore.getState().setReadOnly(msg.payload.readOnly);
        break;
      case 'ACTION_RESULT':
        useUiStore.getState().showToast(msg.payload.message, msg.payload.success);
        break;
      case 'LOGS_RESULT':
        useUiStore.getState().setLogsPanel(msg.payload);
        break;
      case 'DESCRIBE_RESULT':
        useUiStore.getState().setDescribePanel(msg.payload);
        break;
      case 'ERROR':
        useUiStore.getState().setConnection('error', msg.payload.message);
        break;
    }
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // Expose send globally so ContextMenu and other non-hook components can dispatch actions.
  useEffect(() => { registerSender(send); }, [send]);

  const sendIntent = useCallback((intent: ConnectIntent) => {
    if (intent.kind === 'mock') {
      wsRef.current?.send(
        JSON.stringify({ type: 'CONNECT_MOCK', payload: null, timestamp: Date.now() }),
      );
    } else {
      wsRef.current?.send(
        JSON.stringify({
          type: 'CONNECT_CLUSTER',
          payload: { kubeconfig: intent.kubeconfig },
          timestamp: Date.now(),
        }),
      );
    }
  }, []);

  const open = useCallback(() => {
    manualClose.current = false;
    const ui = useUiStore.getState();
    ui.setConnection(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      useUiStore.getState().setConnection('connected');
      if (intentRef.current) sendIntent(intentRef.current);
    };

    ws.onmessage = (ev) => {
      try {
        dispatch(JSON.parse(ev.data) as ServerMessage);
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (manualClose.current) return;
      const attempt = attemptRef.current;
      if (attempt >= BACKOFF_MS.length) {
        useUiStore
          .getState()
          .setConnection('error', 'Connection lost. Retry from the landing screen.');
        return;
      }
      const delay = BACKOFF_MS[attempt];
      attemptRef.current = attempt + 1;
      useUiStore.getState().setConnection('reconnecting');
      reconnectTimer.current = setTimeout(open, delay);
    };
  }, [dispatch, sendIntent]);

  /** Begin a session with the given intent (mock or live cluster). */
  const connect = useCallback(
    (intent: ConnectIntent) => {
      intentRef.current = intent;
      attemptRef.current = 0;
      open();
    },
    [open],
  );

  const disconnect = useCallback(() => {
    manualClose.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return { connect, disconnect, send };
}
