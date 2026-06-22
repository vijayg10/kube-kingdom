import { useEffect, useRef } from 'react';
import { useCityLayout } from '../../hooks/useCityLayout';
import { useUiStore } from '../../store/uiStore';

const SIZE = 200;

/**
 * Corner minimap (PROMPT HUD): color-coded districts drawn on a 2D canvas.
 * Clicking maps the pixel back to a world XZ and asks the camera to fly there
 * via uiStore.cameraTarget.
 */
export function Minimap() {
  const layout = useCityLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { min, max } = layout.terrain.bounds;
  const spanX = max.x - min.x || 1;
  const spanZ = max.z - min.z || 1;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Backdrop
    ctx.fillStyle = '#2b2014';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const toMap = (x: number, z: number): [number, number] => [
      ((x - min.x) / spanX) * SIZE,
      ((z - min.z) / spanZ) * SIZE,
    ];

    // Districts
    for (const d of layout.districts) {
      ctx.beginPath();
      d.wallVertices.forEach((v, i) => {
        const [mx, my] = toMap(v.x, v.z);
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e8d9b5';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Node landmarks as small markers
    ctx.fillStyle = '#f0d27a';
    for (const b of layout.buildings) {
      if (b.resourceType !== 'node') continue;
      const [mx, my] = toMap(b.position.x, b.position.z);
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }, [layout, min.x, min.z, spanX, spanZ]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const worldX = min.x + px * spanX;
    const worldZ = min.z + py * spanZ;
    useUiStore.getState().setCameraTarget([worldX, worldZ]);
  };

  return (
    <div style={wrapStyle}>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onClick={onClick}
        style={{ display: 'block', cursor: 'pointer', borderRadius: 4 }}
      />
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: 'fixed',
  right: 14,
  bottom: 14,
  padding: 6,
  background: 'rgba(43,32,20,0.9)',
  border: '2px solid #b9a05a',
  borderRadius: 8,
  zIndex: 20,
};

export default Minimap;
