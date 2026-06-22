import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCityLayout } from '../../hooks/useCityLayout';
import { useUiStore, type Selection } from '../../store/uiStore';
import { sceneRefs } from '../../render/sceneRefs';

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Shift+drag box-select (T037). Plain left-drag pans the camera (MapControls);
 * holding Shift draws a selection rectangle and selects every pod whose
 * projected screen position falls inside it. Aggregate summary is shown by
 * DetailPanel.
 */
export function BoxSelect() {
  const layout = useCityLayout();
  const buildingsRef = useRef(layout.buildings);
  buildingsRef.current = layout.buildings;
  const [rect, setRect] = useState<Rect | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!e.shiftKey || e.button !== 0) return;
      dragging.current = true;
      if (sceneRefs.controls) sceneRefs.controls.enabled = false;
      setRect({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setRect((r) => (r ? { ...r, x1: e.clientX, y1: e.clientY } : r));
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (sceneRefs.controls) sceneRefs.controls.enabled = true;
      setRect((r) => {
        if (r) commitSelection(r, buildingsRef.current);
        return null;
      });
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  if (!rect) return null;
  const left = Math.min(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const width = Math.abs(rect.x1 - rect.x0);
  const height = Math.abs(rect.y1 - rect.y0);

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        border: '1.5px solid #e8d9b5',
        background: 'rgba(232,217,181,0.18)',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
}

const _v = new THREE.Vector3();

function commitSelection(rect: Rect, buildings: ReturnType<typeof useCityLayout>['buildings']) {
  const camera = sceneRefs.camera;
  if (!camera) return;
  const minX = Math.min(rect.x0, rect.x1);
  const maxX = Math.max(rect.x0, rect.x1);
  const minY = Math.min(rect.y0, rect.y1);
  const maxY = Math.max(rect.y0, rect.y1);
  const w = window.innerWidth;
  const h = window.innerHeight;

  const selected: Selection[] = [];
  for (const b of buildings) {
    if (b.resourceType !== 'pod') continue;
    _v.set(b.position.x, b.position.y, b.position.z).project(camera);
    if (_v.z > 1) continue; // behind camera
    const sx = ((_v.x + 1) / 2) * w;
    const sy = ((1 - _v.y) / 2) * h;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
      selected.push({ kind: 'pod', id: b.resourceId });
    }
  }
  if (selected.length > 0) useUiStore.getState().setMultiSelection(selected);
}

export default BoxSelect;
