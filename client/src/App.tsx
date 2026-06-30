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
import { useBGM } from './hooks/useBGM';

/**
 * App shell + view routing (landing ↔ city). Owns the single WebSocket session.
 */
export default function App() {
  const view = useUiStore((s) => s.view);
  const connection = useUiStore((s) => s.connection);
  const setView = useUiStore((s) => s.setView);
  const { connect, disconnect } = useWebSocket();
  useBGM();

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
        onConnectCluster={(context) => start({ kind: 'cluster', context })}
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
        <ClusterUnavailableModal onLeave={leave} />
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

function ClusterUnavailableModal({ onLeave }: { onLeave: () => void }) {
  const error = useUiStore((s) => s.connectionError);
  return (
    <div style={modalBackdrop}>
      <div style={modalBox}>

        <h2 style={modalTitle}>Cluster Unavailable</h2>
        <p style={modalMessage}>
          {error ?? 'The cluster is not reachable. Check that it is running and try again.'}
        </p>
        <button className="kk-dialogue-btn" style={modalBtn} onClick={onLeave}>
          Return to Landing
        </button>
      </div>
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


const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,6,2,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 80,
};

const modalBox: React.CSSProperties = {
  backgroundImage: 'url(/textures/T_Dialogue_BG.png)',
  backgroundSize: '100% 100%',
  border: 'none',
  borderRadius: 18,
  padding: '5.5rem 3rem 2.8rem',
  width: 380,
  textAlign: 'center',
  boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
  color: '#3a2010',
  fontFamily: "'Cinzel', serif",
};

const modalIcon: React.CSSProperties = {
  width: 44,
  height: 44,
  marginBottom: '0.6rem',
};

const modalTitle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1.25rem',
  fontWeight: 700,
  fontFamily: "'Cinzel', serif",
  letterSpacing: '0.04em',
};

const modalMessage: React.CSSProperties = {
  fontSize: '0.88rem',
  fontFamily: "'IM Fell English', serif",
  opacity: 0.85,
  margin: '0 0 1.6rem',
  lineHeight: 1.7,
};

const modalBtn: React.CSSProperties = {
  padding: '0.6rem 1.6rem',
  fontSize: '0.85rem',
  fontFamily: "'Cinzel', serif",
  letterSpacing: '0.05em',
  backgroundImage: 'url(/textures/T_Button_BG.png)',
  backgroundSize: '100% 100%',
  color: '#e8d9b5',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
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
