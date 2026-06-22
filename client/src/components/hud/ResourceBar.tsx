import { useClusterStore } from '../../store/clusterStore';

/**
 * Top HUD resource bar (PROMPT HUD, FR-008): cluster-level totals — pods,
 * nodes, CPU%, memory%, and healthy/unhealthy split. Consumes the 5s
 * SUMMARY_UPDATED feed via clusterStore.summary.
 */
export function ResourceBar() {
  const summary = useClusterStore((s) => s.summary);
  if (!summary) return null;

  return (
    <div style={bar}>
      <Stat label="Pods" value={String(summary.totalPods)} />
      <Stat label="Nodes" value={String(summary.totalNodes)} />
      <Gauge label="CPU" pct={summary.cpuPercent} />
      <Gauge label="Memory" pct={summary.memoryPercent} />
      <Stat label="Healthy" value={String(summary.healthyPods)} color="#7fd36a" />
      <Stat
        label="Unhealthy"
        value={String(summary.unhealthyPods)}
        color={summary.unhealthyPods > 0 ? '#e8896f' : '#cdbf9a'}
      />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={cell}>
      <span style={statLabel}>{label}</span>
      <span style={{ ...statValue, color: color ?? '#f3e7c6' }}>{value}</span>
    </div>
  );
}

function Gauge({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped > 85 ? '#e8896f' : clamped > 65 ? '#e0b85a' : '#7fd36a';
  return (
    <div style={cell}>
      <span style={statLabel}>{label}</span>
      <div style={gaugeTrack}>
        <div style={{ ...gaugeFill, width: `${clamped}%`, background: color }} />
        <span style={gaugeText}>{clamped}%</span>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 0,
  padding: '8px 10px',
  background: 'linear-gradient(#2b2014ee, #20170dee)',
  border: '2px solid #b9a05a',
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  fontFamily: 'inherit',
  color: '#f3e7c6',
  zIndex: 20,
  boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
};

const cell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0 16px',
  borderRight: '1px solid #5a4a2e',
  minWidth: 72,
};

const statLabel: React.CSSProperties = {
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  opacity: 0.7,
};
const statValue: React.CSSProperties = { fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.2 };

const gaugeTrack: React.CSSProperties = {
  position: 'relative',
  width: 84,
  height: 18,
  marginTop: 4,
  background: '#1a130a',
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid #5a4a2e',
};
const gaugeFill: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  transition: 'width 0.6s ease',
};
const gaugeText: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#fff',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
};

export default ResourceBar;
