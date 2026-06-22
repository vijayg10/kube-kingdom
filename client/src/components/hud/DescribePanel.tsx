import { useUiStore } from '../../store/uiStore';

/**
 * Floating describe panel (US5, T058, FR-021).
 * Shows raw JSON / describe text for a selected resource.
 */
export function DescribePanel() {
  const payload = useUiStore((s) => s.describePanel);
  const close = useUiStore((s) => s.closeDescribePanel);

  if (!payload) return null;
  const { kind, name, namespace, text } = payload;

  return (
    <div style={overlay} onClick={close}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={titleBar}>
          <span style={title}>
            {kind} — {namespace ? `${namespace}/` : ''}{name}
          </span>
          <button style={closeBtn} onClick={close}>✕</button>
        </div>
        <pre style={pre}>{text}</pre>
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
  width: 760,
  maxWidth: '92vw',
  maxHeight: '78vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#100d08',
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
  fontSize: '0.76rem',
  lineHeight: 1.55,
  color: '#d4c89a',
  fontFamily: '"Courier New", Courier, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export default DescribePanel;
