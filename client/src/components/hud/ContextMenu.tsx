import { useState, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useClusterStore } from '../../store/clusterStore';
import { sendWsMessage } from '../../hooks/wsClient';

/**
 * Right-click context menu (US5, T054 + T055, FR-014 + FR-015).
 * Appears at the cursor position when the user right-clicks a pod, node, or
 * deployment building. Mutation items are hidden in read-only mode (FR-016).
 * Destructive actions (Delete, Restart) show an inline confirmation (FR-015).
 */
export function ContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu);
  const readOnly = useUiStore((s) => s.readOnly);
  const closeContextMenu = useUiStore((s) => s.closeContextMenu);
  const [confirm, setConfirm] = useState<string | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if ('key' in e && e.key !== 'Escape') return;
      closeContextMenu();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [contextMenu, closeContextMenu]);

  // Reset confirm state when the menu closes.
  useEffect(() => { if (!contextMenu) setConfirm(null); }, [contextMenu]);

  if (!contextMenu) return null;
  const { x, y, target } = contextMenu;

  const pods = useClusterStore.getState().pods;
  const nodes = useClusterStore.getState().nodes;

  const pod = target.kind === 'pod' ? pods.get(target.id) : undefined;
  const node = target.kind === 'node' ? nodes.get(target.id) : undefined;
  const label = pod?.name ?? node?.name ?? target.id;

  const execute = (action: string) => {
    const ts = Date.now();
    if (action === 'restart' && pod) {
      sendWsMessage({ type: 'ACTION_RESTART_POD', payload: { name: pod.name, namespace: pod.namespace }, timestamp: ts });
    } else if (action === 'delete' && pod) {
      sendWsMessage({ type: 'ACTION_DELETE_POD', payload: { name: pod.name, namespace: pod.namespace }, timestamp: ts });
    } else if (action === 'cordon' && node) {
      sendWsMessage({ type: 'ACTION_CORDON_NODE', payload: { name: node.name, cordon: !node.cordoned }, timestamp: ts });
    } else if (action === 'logs' && pod) {
      sendWsMessage({ type: 'ACTION_VIEW_LOGS', payload: { name: pod.name, namespace: pod.namespace }, timestamp: ts });
    } else if (action === 'describe') {
      const kind = pod ? 'Pod' : node ? 'Node' : 'Deployment';
      const name = pod?.name ?? node?.name ?? target.id;
      const namespace = pod?.namespace ?? '';
      sendWsMessage({ type: 'ACTION_DESCRIBE', payload: { kind, name, namespace }, timestamp: ts });
    }
    closeContextMenu();
  };

  const tryAction = (action: string) => {
    if (action === 'restart' || action === 'delete') {
      setConfirm(action);
    } else {
      execute(action);
    }
  };

  return (
    <div
      style={{ ...menuStyle, left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={header}>{label}</div>

      {confirm ? (
        <div style={confirmBox}>
          <div style={confirmText}>
            {confirm === 'restart' ? 'Restart this pod?' : 'Delete this pod?'}
          </div>
          <div style={confirmRow}>
            <button style={dangerBtn} onClick={() => execute(confirm)}>Confirm</button>
            <button style={cancelBtn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {pod && (
            <>
              {!readOnly && <Item label="Restart Pod" icon="↺" onClick={() => tryAction('restart')} danger />}
              {!readOnly && <Item label="Delete Pod" icon="✕" onClick={() => tryAction('delete')} danger />}
              <Item label="View Logs" icon="≡" onClick={() => tryAction('logs')} />
              <Item label="Describe" icon="ℹ" onClick={() => tryAction('describe')} />
            </>
          )}
          {node && (
            <>
              {!readOnly && (
                <Item
                  label={node.cordoned ? 'Uncordon Node' : 'Cordon Node'}
                  icon="⛔"
                  onClick={() => tryAction('cordon')}
                />
              )}
              <Item label="Describe" icon="ℹ" onClick={() => tryAction('describe')} />
            </>
          )}
          {readOnly && (
            <div style={readOnlyNote}>Read-only mode — mutations disabled</div>
          )}
        </>
      )}
    </div>
  );
}

function Item({ label, icon, onClick, danger }: { label: string; icon: string; onClick: () => void; danger?: boolean }) {
  return (
    <button style={{ ...item, color: danger ? '#e05030' : '#e8d9b5' }} onClick={onClick}>
      <span style={{ marginRight: 8, opacity: 0.7 }}>{icon}</span>
      {label}
    </button>
  );
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  minWidth: 190,
  background: 'rgba(20,13,6,0.97)',
  border: '2px solid #b9a05a',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
  zIndex: 50,
  overflow: 'hidden',
  fontFamily: 'inherit',
};

const header: React.CSSProperties = {
  padding: '8px 14px 6px',
  fontSize: '0.72rem',
  color: '#b9a05a',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid rgba(185,160,90,0.3)',
};

const item: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const confirmBox: React.CSSProperties = {
  padding: '10px 14px',
};

const confirmText: React.CSSProperties = {
  fontSize: '0.82rem',
  color: '#e8d9b5',
  marginBottom: 10,
};

const confirmRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const dangerBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  background: '#8b2a1a',
  border: '1px solid #c0392b',
  borderRadius: 5,
  color: '#fff',
  fontSize: '0.8rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const cancelBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  background: 'transparent',
  border: '1px solid #b9a05a',
  borderRadius: 5,
  color: '#e8d9b5',
  fontSize: '0.8rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const readOnlyNote: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '0.75rem',
  color: '#888',
  fontStyle: 'italic',
};

export default ContextMenu;
