import { useCallback } from 'react';
import { CityScene } from './components/city/CityScene';
import { LandingScreen } from './components/landing/LandingScreen';
import { Minimap } from './components/hud/Minimap';
import { DetailPanel } from './components/hud/DetailPanel';
import { BoxSelect } from './components/hud/BoxSelect';
import { ResourceBar } from './components/hud/ResourceBar';
import { AudioControls } from './components/hud/AudioControls';
import { ContextMenu } from './components/hud/ContextMenu';
import { LogsPanel } from './components/hud/LogsPanel';
import { DescribePanel } from './components/hud/DescribePanel';
import { Toast } from './components/hud/Toast';
import { useUiStore } from './store/uiStore';
import { useClusterStore } from './store/clusterStore';
import { useWebSocket, type ConnectIntent } from './hooks/useWebSocket';

/**
 * App shell + view routing (landing ↔ city). Owns the single WebSocket session.
 */
export default function App() {
  const view = useUiStore((s) => s.view);
  const connection = useUiStore((s) => s.connection);
  const setView = useUiStore((s) => s.setView);
  const { connect, disconnect } = useWebSocket();

  const start = useCallback(
    (intent: ConnectIntent) => {
      connect(intent);
      setView('city');
    },
    [connect, setView],
  );

  const leave = useCallback(() => {
    disconnect();
    useClusterStore.getState().reset();
    useUiStore.getState().setConnection('idle');
    setView('landing');
  }, [disconnect, setView]);

  if (view === 'landing') {
    return (
      <LandingScreen
        onExploreDemo={() => start({ kind: 'mock' })}
        onConnectCluster={(kubeconfig) => start({ kind: 'cluster', kubeconfig })}
      />
    );
  }

  return (
    <>
      <CityScene />
      <LoadingOverlay />
      <button onClick={leave} style={backBtn}>
        ← Leave City
      </button>
      <ConnectionBadge status={connection} />
      {connection === 'error' && (
        <ErrorBanner onLeave={leave} />
      )}
      <ResourceBar />
      <DetailPanel />
      <Minimap />
      <BoxSelect />
      <AudioControls />
      <ContextMenu />
      <LogsPanel />
      <DescribePanel />
      <Toast />
    </>
  );
}

function LoadingOverlay() {
  const topologyVersion = useClusterStore((s) => s.topologyVersion);
  const loaded = topologyVersion > 0;
  return (
    <div className={`kk-loading-overlay${loaded ? ' hidden' : ''}`}>
      <div className="kk-loading-ring" />
      <span className="kk-loading-text">Summoning the Kingdom&hellip;</span>
    </div>
  );
}

function ErrorBanner({ onLeave }: { onLeave: () => void }) {
  const error = useUiStore((s) => s.connectionError);
  return (
    <div style={errorBanner}>
      <span style={{ fontSize: '1.1rem' }}>⚠</span>
      <span style={{ flex: 1 }}>{error ?? 'Connection lost. The city has gone dark.'}</span>
      <button style={errorLeaveBtn} onClick={onLeave}>Return to Landing</button>
    </div>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const color =
    status === 'connected' ? '#5fae4c' : status === 'error' ? '#c8412f' : '#e0a53a';
  return (
    <div style={{ ...badge, borderColor: color }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
      {status}
    </div>
  );
}

const backBtn: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  padding: '0.4rem 0.9rem',
  fontFamily: 'inherit',
  color: '#2b2014',
  background: '#e8d9b5',
  border: '2px solid #b9a05a',
  borderRadius: 6,
  cursor: 'pointer',
  zIndex: 20,
};

const errorBanner: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  padding: '12px 20px',
  background: 'rgba(140,30,20,0.95)',
  border: 'none',
  borderBottom: '2px solid #c8412f',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  zIndex: 80,
};

const errorLeaveBtn: React.CSSProperties = {
  padding: '5px 14px',
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: 5,
  color: '#fff',
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const badge: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0.35rem 0.8rem',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  color: '#e8d9b5',
  background: 'rgba(20,13,6,0.8)',
  border: '2px solid #b9a05a',
  borderRadius: 6,
  zIndex: 20,
};
