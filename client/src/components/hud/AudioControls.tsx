import { useEffect, useState } from 'react';
import { audio } from '../../audio/audio';
import { useClusterStore } from '../../store/clusterStore';
import { isIncident } from '../city/traffic/trafficState';

/**
 * HUD audio toggle (US4, FR-019). Click to start/stop ambient sound (the click
 * is the user gesture the AudioContext needs). While unmuted, an incident in the
 * live traffic feed ramps up the alarm.
 */
export function AudioControls() {
  const [muted, setMuted] = useState(audio.isMuted());

  // Monitor incidents and drive the alarm (only meaningful while unmuted).
  useEffect(() => {
    const id = setInterval(() => {
      const traffic = useClusterStore.getState().traffic;
      let active = false;
      for (const e of traffic.values()) {
        if (isIncident(e)) {
          active = true;
          break;
        }
      }
      audio.setIncident(active);
    }, 600);
    return () => {
      clearInterval(id);
      audio.setIncident(false);
    };
  }, []);

  const toggle = () => setMuted(audio.toggleMuted());

  return (
    <button style={btn} onClick={toggle} title={muted ? 'Unmute' : 'Mute'}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

const btn: React.CSSProperties = {
  position: 'fixed',
  bottom: 14,
  left: 14,
  width: 40,
  height: 40,
  fontSize: '1.1rem',
  color: '#e8d9b5',
  background: 'rgba(20,13,6,0.8)',
  border: '2px solid #b9a05a',
  borderRadius: 8,
  cursor: 'pointer',
  zIndex: 20,
};

export default AudioControls;
