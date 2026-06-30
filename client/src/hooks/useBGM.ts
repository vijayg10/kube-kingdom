import { useEffect, useRef, useState } from 'react';

const bgm = new Audio('/sounds/BGM1.mp3');
bgm.loop = true;
bgm.volume = 0.4;

const dagger = new Audio('/sounds/DAGGER1.mp3');
dagger.volume = 0.6;

function playClick() {
  const sfx = dagger.cloneNode() as HTMLAudioElement;
  sfx.volume = dagger.volume;
  sfx.play().catch(() => {});
}

export function useBGM() {
  const [muted, setMuted] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const start = () => {
      if (started.current) return;
      started.current = true;
      bgm.play().catch(() => {});
    };
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, []);

  useEffect(() => {
    let downAt = 0;
    const onDown = () => { downAt = Date.now(); };
    const onUp = () => { if (Date.now() - downAt < 200) playClick(); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const toggle = () => {
    bgm.muted = !muted;
    setMuted((m) => !m);
  };

  return { muted, toggle };
}

export function toggleBGM() {
  bgm.muted = !bgm.muted;
  return bgm.muted;
}

export function isBGMMuted() {
  return bgm.muted;
}
