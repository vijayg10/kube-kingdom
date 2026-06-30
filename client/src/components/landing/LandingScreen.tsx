import { useState, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { AudioControls } from '../hud/AudioControls';

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace(/^ws/, 'http');

interface ServerConfig {
  mockMode: boolean;
  contexts: string[];
  current: string | null;
}

async function fetchConfig(): Promise<ServerConfig> {
  const res = await fetch(`${API_BASE}/api/contexts`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json() as Promise<ServerConfig>;
}

export function LandingScreen({
  onExploreDemo,
  onConnectCluster,
}: {
  onExploreDemo: () => void;
  onConnectCluster: (context: string) => void;
}) {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const error = useUiStore((s) => s.connectionError);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSelected(cfg.current ?? cfg.contexts[0] ?? '');
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div style={wrap}>
      <AudioControls />
      <div style={panel}>
        <img src="/kube-kingdom.png" alt="Kube Kingdom" style={logo} />
        <p style={subtitle}>Your cluster, rendered as a living medieval city.</p>

        {!config && !fetchError && (
          <p style={hint}>Connecting to server…</p>
        )}

        {config?.mockMode && (
          <button className="kk-dialogue-btn" style={primaryBtn} onClick={onExploreDemo}>
            Explore Demo
          </button>
        )}

        {config && !config.mockMode && (
          <div style={formCol}>
            <label style={label}>Select context</label>
            {config.contexts.length === 0 ? (
              <p style={hint}>No contexts found in kubeconfig.</p>
            ) : (
              <select
                style={selectStyle}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {config.contexts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              className="kk-dialogue-btn"
              style={primaryBtn}
              disabled={!selected}
              onClick={() => onConnectCluster(selected)}
            >
              Enter the City
            </button>
          </div>
        )}

        {fetchError && <p style={errorStyle}>⚠ {fetchError}</p>}
        {error && <p style={errorStyle}>⚠ {error}</p>}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundImage: 'url(/textures/T_LandingPage_BG.png)',
  backgroundRepeat: 'repeat',
  backgroundSize: 'auto',
  color: '#e8d9b5',
};

const panel: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem 3.5rem',
  background: '#f8f1df',
  border: '2px solid #b9a05a',
  borderRadius: 14,
  boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
  maxWidth: 480,
  color: '#2b2014',
};

const logo: React.CSSProperties = { width: '100%', maxWidth: 380, marginBottom: 8 };
const subtitle: React.CSSProperties = { opacity: 0.8, marginTop: 8, marginBottom: 28 };

const formCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  alignItems: 'stretch',
  textAlign: 'left',
};

const label: React.CSSProperties = { fontSize: '0.9rem', opacity: 0.85 };

const hint: React.CSSProperties = {
  fontSize: '0.9rem',
  opacity: 0.7,
  margin: '4px 0 12px',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  background: '#1a130a',
  color: '#e8d9b5',
  border: '1px solid #8a7550',
  borderRadius: 6,
};

const primaryBtn: React.CSSProperties = {
  padding: '0.7rem 1.6rem',
  fontSize: '0.85rem',
  fontFamily: "'Cinzel', serif",
  fontWeight: 700,
  letterSpacing: '0.05em',
  backgroundImage: 'url(/textures/T_Button_BG.png)',
  backgroundSize: '100% 100%',
  color: '#e8d9b5',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  width: '100%',
};

const errorStyle: React.CSSProperties = { color: '#e8896f', marginTop: 18 };

export default LandingScreen;
