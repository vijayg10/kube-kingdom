import { useEffect } from 'react';
import { useClusterStore } from '../../store/clusterStore';
import { useUiStore } from '../../store/uiStore';
import type { KubeNode, Pod, Secret } from '../../types/cluster';

/**
 * Parchment detail panel (PROMPT Detail Panel, constitution Principle IV).
 * Summary view by default; Expand reveals kubectl-describe-level detail. Closes
 * on Escape or click-away (handled in App / Canvas onPointerMissed).
 */
export function DetailPanel() {
  const selection = useUiStore((s) => s.selection);
  const expanded = useUiStore((s) => s.detailExpanded);
  const multi = useUiStore((s) => s.multiSelection);
  const pods = useClusterStore((s) => s.pods); // reactive — panel stays live
  const nodes = useClusterStore((s) => s.nodes);
  const secrets = useClusterStore((s) => s.secrets);

  // Escape closes (T038).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useUiStore.getState().closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Aggregate (box-select) summary takes precedence.
  if (multi.length > 0) return <AggregatePanel />;
  if (!selection) return null;

  if (selection.kind === 'pod') {
    const pod = pods.get(selection.id);
    if (!pod) return null;
    return <PodDetail pod={pod} expanded={expanded} />;
  }
  if (selection.kind === 'node') {
    const node = nodes.get(selection.id);
    if (!node) return null;
    return <NodeDetail node={node} expanded={expanded} />;
  }
  if (selection.kind === 'secret') {
    const secret = secrets.find((s) => s.uid === selection.id);
    if (!secret) return null;
    return <SecretDetail secret={secret} />;
  }
  return null;
}

function PodDetail({ pod, expanded }: { pod: Pod; expanded: boolean }) {
  const cpu = pod.cpuMillicores < 0 ? 'N/A' : `${pod.cpuMillicores}m`;
  const mem = pod.memoryMiB < 0 ? 'N/A' : `${pod.memoryMiB} MiB`;
  return (
    <Scroll title={pod.name} subtitle={`Pod · ${pod.namespace}`}>
      <Row label="Status" value={pod.health} valueColor={healthColor(pod.health)} />
      <Row label="Node" value={pod.nodeName || '—'} />
      {pod.deploymentName && <Row label="Deployment" value={pod.deploymentName} />}
      <Row label="CPU" value={cpu} />
      <Row label="Memory" value={mem} />
      <Row label="Age" value={age(pod.createdAt)} />
      <Row label="Restarts" value={String(pod.restartCount)} />
      {labelChips(pod.labels)}

      {expanded && (
        <>
          <Divider label="Containers" />
          {pod.containers.map((c) => (
            <div key={c.name} style={subBlock}>
              <Row label="Name" value={c.name} />
              <Row label="Image" value={c.image} />
              <Row label="Ready" value={c.ready ? 'yes' : 'no'} />
              <Row label="Restarts" value={String(c.restartCount)} />
            </div>
          ))}
          <Divider label="Metadata" />
          <Row label="UID" value={pod.uid} />
          <Row label="Created" value={pod.createdAt} />
        </>
      )}
      <ExpandButton expanded={expanded} />
    </Scroll>
  );
}

function NodeDetail({ node, expanded }: { node: KubeNode; expanded: boolean }) {
  const cpuUsed = node.cpu.usedMillicores < 0 ? 'N/A' : `${node.cpu.usedMillicores}m`;
  const memUsed = node.memory.usedMiB < 0 ? 'N/A' : `${node.memory.usedMiB} MiB`;
  return (
    <Scroll title={node.name} subtitle="Node">
      <Row label="Status" value={node.health} valueColor={nodeHealthColor(node.health)} />
      <Row label="Pods" value={String(node.podCount)} />
      <Row label="CPU" value={`${cpuUsed} / ${node.cpu.capacityMillicores}m`} />
      <Row label="Memory" value={`${memUsed} / ${node.memory.capacityMiB} MiB`} />
      <Row label="Cordoned" value={node.cordoned ? 'yes' : 'no'} />
      {expanded && (
        <>
          <Divider label="Labels" />
          {labelChips(node.labels)}
        </>
      )}
      <ExpandButton expanded={expanded} />
    </Scroll>
  );
}

function SecretDetail({ secret }: { secret: Secret }) {
  return (
    <Scroll title={secret.name} subtitle={`Secret · ${secret.namespace}`}>
      <Row label="Type" value={secret.type} />
      <Row label="Keys" value={String(secret.keys.length)} />
      {secret.keys.map((k) => (
        <Row key={k} label="" value={k} />
      ))}
      {labelChips(secret.labels)}
    </Scroll>
  );
}

function AggregatePanel() {
  const multi = useUiStore((s) => s.multiSelection);
  const pods = useClusterStore((s) => s.pods);
  const selectedPods = multi
    .filter((s) => s.kind === 'pod')
    .map((s) => pods.get(s.id))
    .filter((p): p is Pod => !!p);

  const byHealth = new Map<string, number>();
  let cpu = 0;
  let mem = 0;
  for (const p of selectedPods) {
    byHealth.set(p.health, (byHealth.get(p.health) ?? 0) + 1);
    if (p.cpuMillicores > 0) cpu += p.cpuMillicores;
    if (p.memoryMiB > 0) mem += p.memoryMiB;
  }

  return (
    <Scroll title={`${selectedPods.length} resources`} subtitle="Group selection">
      <Row label="Total CPU" value={`${cpu}m`} />
      <Row label="Total Memory" value={`${mem} MiB`} />
      <Divider label="By status" />
      {[...byHealth.entries()].map(([h, n]) => (
        <Row key={h} label={h} value={String(n)} valueColor={healthColor(h)} />
      ))}
    </Scroll>
  );
}

// --- shared bits ---------------------------------------------------------

function ExpandButton({ expanded }: { expanded: boolean }) {
  return (
    <button style={expandBtn} onClick={() => useUiStore.getState().toggleDetailExpanded()}>
      {expanded ? '▲ Collapse' : '▼ Expand details'}
    </button>
  );
}

function Scroll({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={panel}>
      <div style={header}>
        <div style={titleStyle}>{title}</div>
        <div style={subStyle}>{subtitle}</div>
        <button style={closeBtn} onClick={() => useUiStore.getState().closeDetail()}>
          ✕
        </button>
      </div>
      <div style={body}>{children}</div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={row}>
      <span style={rowLabel}>{label}</span>
      <span style={{ ...rowValue, color: valueColor ?? '#2b2014' }}>{value}</span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return <div style={divider}>{label}</div>;
}

function labelChips(labels: Record<string, string>) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return null;
  return (
    <div style={chips}>
      {entries.map(([k, v]) => (
        <span key={k} style={chip}>
          {k}={v}
        </span>
      ))}
    </div>
  );
}

function age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function healthColor(h: string): string {
  if (h === 'Running' || h === 'Succeeded') return '#3f7a2e';
  if (h === 'Restarting' || h === 'Pending') return '#a06a16';
  if (h === 'CrashLoopBackOff' || h === 'Evicted') return '#a83224';
  return '#6a6a6a';
}
function nodeHealthColor(h: string): string {
  if (h === 'Ready') return '#3f7a2e';
  if (h === 'ResourcePressure') return '#a06a16';
  if (h === 'Unreachable') return '#a83224';
  return '#6a6a6a';
}

// --- styles (parchment) --------------------------------------------------

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 14,
  width: 320,
  maxHeight: '78vh',
  overflowY: 'auto',
  background: 'linear-gradient(#efe2c0, #e3d2a8)',
  color: '#2b2014',
  border: '2px solid #b9a05a',
  borderRadius: 10,
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  fontFamily: 'inherit',
  zIndex: 25,
};
const header: React.CSSProperties = {
  position: 'relative',
  padding: '12px 14px',
  borderBottom: '1px solid #c2ab73',
};
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: '1.05rem', paddingRight: 24, wordBreak: 'break-word' };
const subStyle: React.CSSProperties = { fontSize: '0.78rem', opacity: 0.7 };
const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 10,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '1rem',
  color: '#5a4426',
};
const body: React.CSSProperties = { padding: '10px 14px 14px' };
const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '3px 0',
  fontSize: '0.85rem',
};
const rowLabel: React.CSSProperties = { opacity: 0.65 };
const rowValue: React.CSSProperties = { fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' };
const divider: React.CSSProperties = {
  margin: '10px 0 4px',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  opacity: 0.6,
  borderBottom: '1px solid #c2ab73',
};
const subBlock: React.CSSProperties = {
  margin: '4px 0',
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.25)',
  borderRadius: 6,
};
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 };
const chip: React.CSSProperties = {
  fontSize: '0.68rem',
  padding: '2px 6px',
  background: '#d8c391',
  borderRadius: 4,
  wordBreak: 'break-all',
};
const expandBtn: React.CSSProperties = {
  marginTop: 12,
  width: '100%',
  padding: '6px',
  fontFamily: 'inherit',
  background: '#cdb579',
  color: '#2b2014',
  border: '1px solid #a8915a',
  borderRadius: 6,
  cursor: 'pointer',
};

export default DetailPanel;
