import { useUiStore } from '../../store/uiStore';

/**
 * Floating terminal-style log viewer (US5, T058, FR-021).
 * Shows the last 100 lines returned by ACTION_VIEW_LOGS.
 */
export function LogsPanel() {
  const payload = useUiStore((s) => s.logsPanel);
  const close = useUiStore((s) => s.closeLogsPanel);

  if (!payload) return null;
  const { podName, namespace, lines } = payload;

  return (
    <div style={overlay} onClick={close}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={titleBar}>
          <span style={title}>
            Logs — {namespace}/{podName}
          </span>
          <button style={closeBtn} onClick={close}>✕</button>
        </div>
        <pre style={pre}>
          {lines.length ? lines.join('\n') : '(no output)'}
        </pre>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
};

const panel: React.CSSProperties = {
  width: 720,
  maxWidth: '92vw',
  maxHeight: '72vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e0c08',
  border: '2px solid #b9a05a',
  borderRadius: 10,
  overflow: 'hidden',
  fontFamily: 'inherit',
};

const titleBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 14px',
  background: 'rgba(185,160,90,0.12)',
  borderBottom: '1px solid rgba(185,160,90,0.3)',
};

const title: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#b9a05a',
  letterSpacing: '0.05em',
};

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#b9a05a',
  fontSize: '1rem',
  cursor: 'pointer',
};

const pre: React.CSSProperties = {
  flex: 1,
  margin: 0,
  padding: '12px 16px',
  overflowY: 'auto',
  fontSize: '0.78rem',
  lineHeight: 1.6,
  color: '#a8e6a0',
  fontFamily: '"Courier New", Courier, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

export default LogsPanel;
