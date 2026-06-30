import { useState } from 'react';
import { toggleBGM, isBGMMuted } from '../../hooks/useBGM';

export function AudioControls() {
  const [muted, setMuted] = useState(isBGMMuted);

  const toggle = () => setMuted(toggleBGM());

  return (
    <button style={btn} onClick={toggle} title={muted ? 'Unmute' : 'Mute'}>
      <img src={muted ? '/images/BELL_OFF.png' : '/images/BELL_ON.png'} style={icon} />
    </button>
  );
}

const btn: React.CSSProperties = {
  position: 'fixed',
  bottom: 14,
  left: 14,
  width: 44,
  height: 44,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  zIndex: 20,
};

const icon: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

export default AudioControls;
