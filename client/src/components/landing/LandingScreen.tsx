import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';

/**
 * Entry screen (PROMPT Onboarding): "Kube Kingdom" title with two paths —
 * Explore Demo (mock) and Connect Cluster (paste kubeconfig). The pasted
 * kubeconfig is sent to the server in memory only (FR-024); it is never stored
 * client-side beyond this form's local state.
 */
export function LandingScreen({
  onExploreDemo,
  onConnectCluster,
}: {
  onExploreDemo: () => void;
  onConnectCluster: (kubeconfig: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [kubeconfig, setKubeconfig] = useState('');
  const error = useUiStore((s) => s.connectionError);

  return (
    <div style={wrap}>
      <div style={panel}>
        <img src="/kube-kingdom.png" alt="Kube Kingdom" style={logo} />
        <p style={subtitle}>Your cluster, rendered as a living medieval city.</p>

        {!showForm ? (
          <div style={btnRow}>
            <button style={primaryBtn} onClick={onExploreDemo}>
              ⚔ Explore Demo
            </button>
            <button style={secondaryBtn} onClick={() => setShowForm(true)}>
              🏰 Connect Cluster
            </button>
          </div>
        ) : (
          <div style={formCol}>
            <label style={label}>Paste your kubeconfig</label>
            <textarea
              style={textarea}
              value={kubeconfig}
              onChange={(e) => setKubeconfig(e.target.value)}
              placeholder={'apiVersion: v1\nkind: Config\nclusters:\n  - ...'}
              spellCheck={false}
            />
            <div style={btnRow}>
              <button
                style={primaryBtn}
                disabled={kubeconfig.trim().length === 0}
                onClick={() => onConnectCluster(kubeconfig)}
              >
                Enter the City
              </button>
              <button style={secondaryBtn} onClick={() => setShowForm(false)}>
                Back
              </button>
            </div>
          </div>
        )}

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
  background:
    'radial-gradient(circle at 50% 25%, #4a3722 0%, #281c0f 55%, #140d06 100%)',
  color: '#e8d9b5',
};

const panel: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem 3.5rem',
  background: '#f8f1df',
  border: '2px solid #b9a05a',
  borderRadius: 14,
  boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
  maxWidth: 560,
  color: '#2b2014',
};

const logo: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  marginBottom: 8,
};

const subtitle: React.CSSProperties = { opacity: 0.8, marginTop: 8, marginBottom: 28 };

const btnRow: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  marginTop: 8,
};

const formCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  alignItems: 'stretch',
  textAlign: 'left',
};

const label: React.CSSProperties = { fontSize: '0.9rem', opacity: 0.85 };

const textarea: React.CSSProperties = {
  width: '100%',
  height: 160,
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  padding: 10,
  background: '#1a130a',
  color: '#e8d9b5',
  border: '1px solid #8a7550',
  borderRadius: 6,
  resize: 'vertical',
};

const baseBtn: React.CSSProperties = {
  padding: '0.7rem 1.6rem',
  fontSize: '1rem',
  fontFamily: 'inherit',
  borderRadius: 8,
  cursor: 'pointer',
  border: '2px solid #b9a05a',
};

const primaryBtn: React.CSSProperties = {
  ...baseBtn,
  color: '#e8d9b5',
  background: '#2b2014',
};

const secondaryBtn: React.CSSProperties = {
  ...baseBtn,
  color: '#2b2014',
  background: 'transparent',
};

const errorStyle: React.CSSProperties = { color: '#e8896f', marginTop: 18 };

export default LandingScreen;
