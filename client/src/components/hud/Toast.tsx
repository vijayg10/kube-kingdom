import { useUiStore } from '../../store/uiStore';

/** Action result toast — fades in/out automatically (3.5s). */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div style={{ ...base, borderColor: toast.success ? '#5fae4c' : '#c8412f' }}>
      <span style={{ color: toast.success ? '#5fae4c' : '#e05030', marginRight: 8 }}>
        {toast.success ? '✓' : '✗'}
      </span>
      {toast.message}
    </div>
  );
}

const base: React.CSSProperties = {
  position: 'fixed',
  bottom: 68,
  left: 14,
  padding: '9px 16px',
  background: 'rgba(20,13,6,0.92)',
  border: '2px solid',
  borderRadius: 8,
  color: '#e8d9b5',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  zIndex: 30,
  pointerEvents: 'none',
};

export default Toast;
